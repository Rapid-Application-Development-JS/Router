
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(factory);
  } else if (typeof exports === 'object') {
    module.exports = factory(require, exports, module);
  } else {
    root.Router = factory();
  }
}(this, function(require, exports, module) {

var _ALLOWED_MODES = ['node', 'hash', 'history'];
var _DEFAULT_OPTIONS = {mode: 'node', keys: true, root: '/', rerouting: true};

// parse regular expression
var _OPTIONAL_PARAM = /\((.*?)\)/g;
var _NAMED_PARAM = /(\(\?)?:\w+/g;
var _SPLAT_PARAM = /\*\w+/g;
var _ESCAPE_REG_EXP = /[\-{}\[\]+?.,\\\^$|#\s]/g;
var _DEFAULT_ROUTE = /.*/;

var _FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
var _STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

/**
 * Accept route path and returns array of route keys
 * @param string
 * @returns {Array|{index: number, input: string}}
 * @private
 */
function _getRouteKeys(string) {
    var keys = string.match(/:([^\/]+)/g);
    for (var i = 0, l = keys ? keys.length : 0; i < l; i++) {
        keys[i] = keys[i].replace(/[:\(\)]/g, '');
    }
    return keys;
}

/**
 * Accepts route path and returns regular expression
 * @param route
 * @returns {RegExp}
 * @private
 */
function _routeToRegExp(route) {
    route = route.replace(_ESCAPE_REG_EXP, '\\$&')
        .replace(_OPTIONAL_PARAM, '(?:$1)?')
        .replace(_NAMED_PARAM, function (match, optional) {
            return optional ? match : '([^/?]+)';
        })
        .replace(_SPLAT_PARAM, '([^?]*)');

    return new RegExp('^' + route + '(?:\\?*([^/]*))');
}

/**
 * Returns accepted route path without slashes
 * @param path
 * @returns {string}
 * @private
 */
function _clearSlashes(path) {
    return path.toString().replace(/\/$/, '').replace(/^\//, '');
}

/**
 * Accepts Regular Expression and path
 * Returns array of path parameters
 * @param route
 * @param fragment
 * @returns {Array}
 * @private
 */
function _extractParameters(route, fragment) {
    var params = route.exec(fragment).slice(1);

    var map = params.map(function (param, i) {
        if (i === params.length - 1) return param || null;
        return param ? decodeURIComponent(param) : null;
    });

    return map;
}

/**
 * Accepts string object and returns object with that string as attribute's key
 * @param qstr
 * @returns {*}
 * @private
 */
function _parseQuery(qstr) {
    var query, params, pair;
    if (typeof qstr === 'string') {
        query = {};
        params = qstr.split('&');
        for (var i = 0; i < params.length; i++) {
            pair = params[i].split('=');
            query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
        }
    }

    return query;
}

/**
 * Accepts 'parameters' and 'keys' arrays,
 * Returns array of objects with keys from 'keys' argument and values from parameters argument
 * @param parameters
 * @param keys
 * @returns {*}
 * @private
 */
function _prepareArguments(parameters, keys) {
    var wrapper = {}, lastIndex = parameters.length - 1, query = parameters[lastIndex];

    if (keys && keys.length > 0) {
        for (var i = 0; i < keys.length; i++) {
            wrapper[keys[i]] = parameters[i];
        }

        if (parameters[i]) {
            wrapper.query = _parseQuery(parameters[i]);
        }

        parameters = [wrapper];

    } else if (query && query.indexOf('=') > -1) {
        parameters[lastIndex] = _parseQuery(query);
    }

    return parameters;
}

/**
 * Checks if argument function 'fn' has an argument named 'complete' and returns its index
 * @param fn
 * @returns {*}
 * @private
 */
function _asyncDetect(fn) {
    var result = null, args;

    args = fn.toString().replace(_STRIP_COMMENTS, '').match(_FN_ARGS)[1];
    if (args && args.length > 0) {
        args.split(',').forEach(function (item, index) {
            if (item.trim() === 'complete') {
                result = index;
            }
        });
    }

    return result;
}

function RoutingLevel() {
    this._routes = [];
    this._options = JSON.parse(JSON.stringify(_DEFAULT_OPTIONS));
}

/**
 * Adds new route to Router
 * @param path (string) - string
 * @param callback (function) - callback function function that will be called by a certain path
 * @param options (object) - may contain 2 attributes: alias: sting and async: integer
 *  alias - is for deleting the record from the routing table and grouping.
 *  async - is a service parameter for designation of the ordinal number of the
 *  controlling function complete in the parameters
 */
RoutingLevel.prototype.add = function (path, callback, options) {
    var keys, re;

    if (typeof path == 'function') {
        options = callback;
        callback = path;
        re = _DEFAULT_ROUTE;
    } else {
        keys = _getRouteKeys(path);
        re = _routeToRegExp(path);
    }

    this._routes.push({
        async: (options && typeof options.async === 'number') ? options.async : _asyncDetect(callback),
        path: re,
        callback: callback,
        keys: keys,
        alias: (options && options.alias) ? options.alias : path,
        facade: null
    });

    // sort DESC by path length
    this._routes.sort(function (a, b) {
        return b.alias.length - a.alias.length;
    });

    return this;
};

/**
 * Removes a record in the routing table.
 * As a parameter you may transmit path, alias, or callback; the corresponding record will be removed from the table.
 * @param alias (path, alias, or callback)
 */
RoutingLevel.prototype.remove = function (alias) {
    for (var i = this._routes.length - 1, r; i > -1, r = this._routes[i]; i--) {
        if (alias === r.alias || alias === r.callback || alias.toString() === r.path.toString()) {
            this._routes.splice(i, 1);
        } else if (r._routes.length > 0) {
            for (var j = r._routes.length - 1; j > -1; j--) {
                r._routes[j].remove(alias);
            }
        }
    }

    return this;
};

/**
 * Calls the callback methods that are registered for this URL without changing router location
 * @param fragment
 * @param array
 * @param lastURL
 */
RoutingLevel.prototype.check = function (fragment, array, lastURL) {
    var match, node, route, params, should;

    for (var i = 0; i < this._routes.length, route = this._routes[i]; i++) {
        match = fragment.match(route.path);

        if (match) {
            params = _extractParameters(route.path, fragment);
            keys = this._options.keys ? route.keys : null;
            params = _prepareArguments(params, keys);
            should = (fragment.slice(0, match[0].length) !== lastURL.slice(0, match[0].length));

            node = {
                callback: route.callback,
                params: params,
                routes: [],
                async: route.async,
                rootRerouting: this._options.rerouting || should
            };
            array.push(node);

            if (route.facade) {
                fragment = fragment.slice(match[0].length, fragment.length);
                lastURL = lastURL.slice(match[0].length, lastURL.length);
                route.facade.check(fragment, node.routes, lastURL);
            }
            break;
        }
    }

    return array;
};

/**
 * Resets the settings and routing table for the current level; all lower levels will be reset automatically.
 */
RoutingLevel.prototype.drop = function () {
    this._routes = [];
    this.config(_DEFAULT_OPTIONS);

    return this;
};

/**
 * Configures the current level of the router.
 * Accepts object
 * @public
 * @param {Object} options
 */
RoutingLevel.prototype.config = function (options) {
    if (typeof options === 'object') {
        this._options.keys = (typeof options.keys === 'boolean') ? options.keys : this._options.keys;
        this._options.mode = (_ALLOWED_MODES.indexOf(options.mode) !== -1) ? options.mode : this._options.mode;
        this._options.root = options.root ? '/' + _clearSlashes(options.root) + '/' : this._options.root;
        this._options.rerouting = (typeof options.rerouting === 'boolean') ? options.rerouting : this._options.rerouting;
    }

    return this;
};

/**
 * Uses in pair with 'add' function to create subpath
 * @param alias
 */
RoutingLevel.prototype.to = function (alias) {
    var subrouter, route;
    for (var i = 0; i < this._routes.length, route = this._routes[i]; i++) {
        if (alias === route.alias) {
            subrouter = route.facade;
            if (!subrouter) {
                route.facade = subrouter = (new RoutingLevel()).config(this._options);
            }
        }
    }

    return subrouter;
};

var Router = (function (facade) {
    var router = {}, lastURL = '', rollback = false;

    function applyNested(routes) {
        return function (param) {
            if (param === false) {
                rollback = true;
                router.navigate(lastURL);
            } else if (typeof param === 'string') {
                router.route(param);
            } else if (routes && routes.length)
                apply(routes);
        }
    }

    /**
     *
     * @param routes
     */
    function apply(routes) {
        var falseToReject;

        if (routes) {
            for (var i = 0, route; i < routes.length, route = routes[i]; i++) {
                if (typeof route.async === 'number') {
                    route.params.splice(route.async, 0, applyNested(route.routes));
                }
                if (route.rootRerouting) {
                    falseToReject = route.callback.apply(null, route.params);
                }
                if (typeof route.async !== 'number') {
                    applyNested(route.routes)(falseToReject);
                }
            }
        }
    }

    /**
     * Resets the settings and routing table for the current level; all lower levels will be reset automatically.
     * @example Router.drop();
     * @public
     */
    router.drop = function () {
        lastURL = '';
        return facade.drop();
    };

    /**
     * Launches the router for monitoring a route in a browser.
     * Basic level routes only.
     * @example Router.listen();
     */
    router.listen = function () {
        var self = this, current = this.getCurrent();

        clearInterval(this._interval);
        this._interval = setInterval(function () {
            var location = router.getCurrent();
            if (current !== location) {
                current = location;
                self.check(self.getCurrent());
            }

        }, 50);

        window.onpopstate = function (e) {
            if (e.state !== null && e.state !== undefined) {
                clearInterval(self._interval);
                self.check(self.getCurrent());
            }
        };
    };

    /**
     * Calls the callback methods that are registered for this URL without changing router location
     * @param path
     * @example Router.check('someURL');;
     * @public
     */
    router.check = function (path) {
        apply(facade.check(path, [], lastURL));
        return facade;
    };

    /**
     * Calls a change of router location without firing callback methods.
     * @param path
     * @example Router.navigate('someURL');
     * @public
     */
    router.navigate = function (path) {
        var mode = facade._options.mode;
        switch (mode) {
            case 'history':
                history.pushState(null, null, facade._options.root + _clearSlashes(path));
                break;
            case 'hash':
                window.location.href = window.location.href.replace(/#(.*)$/, '') + '#' + path;
                break;
            case 'node':
                lastURL = path;
                break;
        }
        return facade;
    };

    /**
     * Switches the router to a new URL, firing the registered callback methods to execution.
     * @param path
     * @example Router.route('someURL');
     * @public
     */
    router.route = function (path) {
        if (facade._options.mode === 'node')
            this.check(path);
        if (!rollback)
            this.navigate(path);
        rollback = false;

        return facade;
    };

    /**
     * Configures the current level of the router.
     * Accepts object
     * @public
     * @param {Object} options
     * @example Router.config({
         *              mode: 'history',
         *              keys: true,
         *              rerouting: false,
         *              root: '/'
         *          });
     * @public
     */
    router.config = function (options) {
        return facade.config(options);
    };

    /**
     * Uses in pair with 'add' function to create subpath
     * @param alias
     * @example Router.to('path').add('/subpath');
     * @public
     */
    router.to = function (alias) {
        return facade.to(alias);
    };

    /**
     * Adds new route to Router
     * @param path (string) - string
     * @param callback (function) - callback function function that will be called by a certain path
     * @param options (object) - may contain 2 attributes: alias: sting and async: integer
     *  alias - is for deleting the record from the routing table and grouping.
     *  async - is a service parameter for designation of the ordinal number of the
     *  controlling function complete in the parameters
     * @example Router
     *              .add('docs/:id', function (param, complete){
                        // do something
                        complete();
                        }, {alias: 'docs', async: 1}).
     add('docs/new', function (param) {
                        // do something
                        }, {alias: 'docs'});
     * @public
     */
    router.add = function (path, callback, options) {
        return facade.add(path, callback, options);
    };

    /**
     * Removes a record in the routing table.
     * As a parameter you may transmit path, alias, or callback; the corresponding record will be removed from the table.
     * @param alias (path, alias, or callback)
     * @example Router.remove('/docs/:section');
     * @public
     */
    router.remove = function (alias) {
        return facade.remove(alias);
    };

    /**
     * Returns the current URL of the router.
     * Note that this method is present only in the basic level of the router.
     * @public
     */
    router.getCurrent = function () {
        var mode = facade._options.mode, root = facade._options.root, fragment = lastURL;
        if (mode === 'history') {
            fragment = _clearSlashes(decodeURI(location.pathname + location.search));
            fragment = fragment.replace(/\?(.*)$/, '');
            fragment = root !== '/' ? fragment.replace(root, '') : fragment;
        } else if (mode === 'hash') {
            var match = window.location.href.match(/#(.*)$/);
            fragment = match ? match[1] : '';
        }

        return fragment;
    };

    return router;

})(new RoutingLevel());
return Router;

}));
