
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

function _getRouteKeys(string) {
    var keys = string.match(/:([^\/]+)/g);
    for (var i = 0, l = keys ? keys.length : 0; i < l; i += 1) {
        keys[i] = keys[i].replace(/[:\(\)]/g, '');
    }
    return keys;
}

function _routeToRegExp(route) {
    route = route.replace(_ESCAPE_REG_EXP, '\\$&')
        .replace(_OPTIONAL_PARAM, '(?:$1)?')
        .replace(_NAMED_PARAM, function (match, optional) {
            return optional ? match : '([^/?]+)';
        })
        .replace(_SPLAT_PARAM, '([^?]*)');

    return new RegExp('^' + route + '(?:\\?*([^/]*))');
}

function _clearSlashes(path) {
    return path.toString().replace(/\/$/, '').replace(/^\//, '');
}

function _extractParameters(route, fragment) {
    var params = route.exec(fragment).slice(1);

    return params.map(function (param, i) {
        if (i === params.length - 1) return param || null;
        return param ? decodeURIComponent(param) : null;
    });
}

function _parseQuery(qstr) {
    var query, params, pair;
    if (typeof qstr === 'string') {
        query = {};
        params = qstr.split('&');
        for (var i = 0; params, i < params.length; i++) {
            pair = params[i].split('=');
            query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
        }
    }
    return query;
}

function _prepareArguments(parameters, keys) {
    var wrapper = {}, lastIndex = parameters.length - 1, query = parameters[lastIndex];

    if (keys && keys.length > 0) {
        for (var i = 0; i < keys.length; i += 1) {
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

    return this;
};

RoutingLevel.prototype.remove = function (alias) {
    for (var i = this._routes.length - 1, r; i > -1, r = this._routes[i]; i -= 1) {
        if (alias === r.alias || alias === r.callback || alias.toString() === r.path.toString()) {
            this._routes.splice(i, 1);
        }
    }

    return this;
};

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

RoutingLevel.prototype.drop = function () {
    this._routes = [];
    this.config(_DEFAULT_OPTIONS);

    return this;
};

RoutingLevel.prototype.config = function (options) {
    if (typeof options === 'object') {
        this._options.keys = (typeof options.keys === 'boolean') ? options.keys : this._options.keys;
        this._options.mode = (_ALLOWED_MODES.indexOf(options.mode) !== -1) ? options.mode : this._options.mode;
        this._options.root = options.root ? '/' + _clearSlashes(options.root) + '/' : this._options.root;
        this._options.rerouting = (typeof options.rerouting === 'boolean') ? options.rerouting : this._options.rerouting;
    }

    return this;
};

RoutingLevel.prototype.to = function (alias) {
    var subrouter, route;
    for (var i = 0; i < this._routes.length, route = this._routes[i]; i += 1) {
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

    function apply(routes) {
        var falseToReject;

        if (routes)
            for (var i = 0, route; i < routes.length, route = routes[i]; i += 1) {
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

    router.drop = function () {
        lastURL = '';
        return facade.drop();
    };

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

    router.check = function (path) {
        apply(facade.check(path, [], lastURL));
        return facade;
    };

    router.navigate = function (path) {
        var mode = facade._options.mode;
        switch (mode) {
            case 'history':
                history.pushState(null, null, root + _clearSlashes(path));
                break;
            case 'hash':
                window.location.href.match(/#(.*)$/);
                window.location.href = window.location.href.replace(/#(.*)$/, '') + '#' + path;
                break;
            case 'node':
                lastURL = path;
                break;
        }
        return facade;
    };

    router.route = function (path) {
        if (facade._options.mode === 'node')
            this.check(path);
        if (!rollback)
            this.navigate(path);
        rollback = false;

        return facade;
    };

    router.config = function (options) {
        return facade.config(options);
    };

    router.to = function (alias) {
        return facade.to(alias);
    };

    router.add = function (path, callback, alias) {
        return facade.add(path, callback, alias);
    };

    router.remove = function (alias) {
        return facade.remove(alias);
    };

    router.getCurrent = function () {
        var mode = facade._options.mode, root = facade._options.root, fragment = lastURL;
        if (mode === 'history') {
            fragment = _clearSlashes(decodeURI(location.pathname + location.search));
            fragment = fragment.replace(/\?(.*)$/, '');
            fragment = root !== '/' ? fragment.replace(root, '') : fragment;
            fragment = _clearSlashes(fragment);
        } else if (mode === 'hash') {
            var match = window.location.href.match(/#(.*)$/);
            fragment = match ? match[1] : '';
            fragment = _clearSlashes(fragment);
        }

        return fragment;
    };

    return router;

})(new RoutingLevel());
return Router;

}));
