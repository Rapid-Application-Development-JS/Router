# Router
Lightweight JavaScript microlibrary, just about 300 lines (5KB), it allows to organize URL identification and routing in your app.

##Capabilities
* [**nested routing**](#example) with parameters and query string.
* **parameters and query string** from a URL line can be transmitted **as separate parameters of a callback function call**, as well as collected in **one object of parameters with keys from a URL template** [backbone & angular parameters style](#keys).
* **synchronous or asynchronous callbacks** for routing with the help of [**Dependency Injection**](#complete).
* possibility to execute only those nested routers that have their route changed [**without calling the execution of root routers**](#rerouting). This helps avoid repeated calls or checks as for the necessity of their execution while changing the content of a part of the page.
*  [**default routing**](#default) - you may set a callback function for any routing level; this function will be executed if there is no match with the query string.
*  different [**work modes**](#mode) of the router can work in both `hash` and `history` modes, as well as outside the browser, by just comparing the string (`node` mode).
*  [**optional parameters**](#path) in URL, for example `/docs/:section(/:subsection)`.
*  it's possible to define [**URL templates for an unknown number of parameters**](#path), for example `file/*path`.
*  [adding](#add) and [removing](#remove) records in the routing table, system of [aliases](#options).
*  convenient [**semantic record**](#example) of routers for different levels.
*  **absence of dependencies**, it's possible to use along with any framework.
*  [**option of resetting the router to default state**](#drop).
*  option of executing callbacks [**without changing the URL**](#check).
*  [**changing the URL without executing callbacks**](#navigate).
*  getting the [current URL](#getCurrent).
*  option of automatic [**rollback**](#rollback).

##<a name="example"></a>Example
Adding a new route is carried out via [`add`](#add).
For example, you need to create a routing table for the following structure:

```
|~index ('/')
| |~posts ('/posts') // smth async
| | |-showPost ('/:id')
| | |-newPost ('/new')
| | |-editPost ('/edit')
| |~about ('/about/:id')
```
In this case the description of your router will look as follows:

```javascript
var posts = 'posts';
var showPost = '/:id';
var newPost = '/new';
var editPost = '/edit'
var about = 'about/:id';

Router
	.add(about, function(params) { // ~about ('/about/:id')
		// todo your code
	})
	.add(posts, function(params, complite) { // ~posts ('/posts')
		// todo your code
		complete(); // do it by async way 
	})
	.add(function(){ // default route  for ~index ('/')
		// todo default code
	});
	
Router.to(posts)
	.add(showPost, function (params){
	// todo your code
	})
	.add(newPost, function (params){
	// todo your code
	})
	.add(editPost, function (params){
	// todo your code
	});
```
Note that the record gets structured by routing levels, and the transition between [levels](#levels) is executed via a method named [to](#t0).

You may make any callback method [asynchronous](#async) or add [rollback](#rollback) functionality to it.

It's also possible to move a part of the configuration code to component files, if necessary.

> Depending on conditions, you might need to register only one callback method, for example, for the URL `posts/new`. It's easy, and it's enough to register this record before the registration of the basic record:
> 
```javascript
Router
	.add(about, function(params) { // ~about ('/about/:id')
		// todo your code
	})
	.add(posts + newPost, function(params) { // only one callback for full URL
		// todo your code
	})
	.add(posts, function(params, complite) { // ~posts ('/posts')
		// todo your code
		complete(); // do it by async way 
	})
	.add(function(){ // default route  for ~index ('/')
		// todo default code
	});
Router.to(posts)
	.add(showPost, function (params){
	// todo your code
	})
	.add(editPost, function (params){
	// todo your code
	});
``` 

##Docs
###<a name="levels"></a>levels
Embedded routers that belong to one parent (basic) node, are called **levels**, and in the general case the routing table of your app has the form of a tree, for example:

```
|~index ('/')
| |~posts ('/posts')
| | |-showPost ('/:id')
| | |-newPost ('/new')
| | |-editPost ('/edit')
| |~about ('/about/:id')
```
You may check the way this tree is described [in the example](#example).

###<a name="listen"></a>listen
In order to launch the router for monitoring a route in a browser, you only have to execute a method named `listen`:

```javascript
Router.listen();
```
> Note that this method is present only on the basic level of the router; this means you will not be able to create an embedded level and launch it for monitoring. It's made to avoid any confusion.

###<a name="config"></a>config
Configures the current level of the router. Upon creating a sublevel with the help of [`to`](#to), the settings of the embedded level are inherited automatically.

```javascrip
var configuration = {
	keys: true,
	mode: 'hash',
	rerouting: false,
	root: '/'
};

Router.config(configuration)
	.add(...);
```

The following settings are available:

* <a name="keys"></a>**keys** - option that allows to change the means of transmitting parameters to the callback function between *angular style* - **true** and *backbone style* - **false**. This means, in the first case all parameters are transmitted, being packed in a single object, including `query string`; the keys of the object are parameters of path. For example, when registering path as `docs/:id/paragraph/:number`, the following URL: `docs/15/paragraph/16.html?lang=rus` by `keys: true` will restore the following object as the first parameter of the callback function:
* 
	```javascript
{
	id: '15',
	number: '16.html'
	query: {
		lang: 'rus'
	}
}
```
In case of `keys: false`, `id`, `number` and `query` are transmitted as 3 parameters to the callback function respectively.

* <a name="mode"></a>**mode** - possible values:`node`, `hash` and `history`. `hash` and `history` are browser modes. `node` is a service mode, and a response of the router happens upon transmitting a URL line in the [route](#route) method. The default value is `hash`.
* <a name="rerouting"></a>**rerouting** - can take values **true** or **false**. In the first case, when you change the URL, there is a call of callbacks on all levels; in case of `rerouting: false` only embedded callbacks with changed URL fire; this means, for example, if the URL `customers/:customerID/users/:userID/docs/:docID/` is changed to `customers/:customerID/users/:userID/profile/`, only the callback `profile` will fire, while basic callbacks on `customers/:customerID` and `/users/:userID` will not be called.
* <a name="root"></a>**root** - this option works only for the upper level of routing and allows to set the basic URL.

###<a name="drop"></a>drop
Resets the settings and routing table for the current level; all lower levels will be reset automatically. This means, by resetting the basic level you reset the whole router.

```javascrip
Router.drop();
```
###<a name="route"></a>route
Switches the router to a new URL, calling the registered callback methods to execution.

```javascrip
Router.route(URL);
```
This method consists of a sequence [navigate](navigate#) and [check](#check).
> In case of `mode: 'node'` first fires `check`, then `navigate`.
> 
> Note that this method is present only in the basic level of the router.

###<a name="getCurrent"></a>getCurrent
Restores the current URL of the router.
```javascrip
var url = Router.getCurrent();
```
> Note that this method is present only in the basic level of the router.

###<a name="check"></a>check
Calls the callback methods that are registered for this URL without changing router location. 

```javascrip
Router.check(URL);
```

###<a name="navigate"></a>navigate
Calls a change of router location without firing callback methods.

```javascrip
Router.navigate(URL);
```

> Note that this method is present only in the basic level of the router.

###<a name="add"></a>add
Adding routes is as follows:

```javascript
// base level
Router
	.add('docs/:id', callback1, options)
	.add('about', callback2)
	.add(defaultRouteCallback);
	
// sublevel
Router.to('posts') // route or alias
	.add('/:id', callback3)
	.add('/new', callback4)
	.add('/edit', callback5);
```
Description of routing table levels always comes downwards; this means you have to describe the parent level for adding a sublevel.

In order to add a route as a sublevel, you have to move to a new level using [**to**](#to).

> Note that in basic-level routes (*in cases of using history API*) it's better not to use `/` at the beginning of the route.

Adding a route generally looks like this:

```javascript
Router.add(path, callback, options);
```
Where:

* <a name="path"></a>**path** - routing path; its semantics fully coincides with the route description in [Backbone.js](http://backbonejs.org/#Router-routes). You may describe just like in **backbone.js** (the only difference is how parameters and query string are transmitted to the callback function):
> Routes can contain parameter parts, `:param`, which match a single URL component between slashes; and splat parts `*splat`, which can match any number of URL components. Part of a route can be made optional by putting it in parentheses `(/:optional)`.
> 
> For example, route `"search/:query/p:page"` will match a fragment of `#search/obama/p2`, passing `"obama"` and `"2"` to action. **Whether parameters must be packed in a single object for the transmission, depends on the router settings, see [config](#config).**
> 
> Route `"file/*path"` will match `#file/nested/folder/file.txt`, passing `"nested/folder/file.txt"` to action as single parameter.
> 
> Route `"docs/:section(/:subsection)"` will match `#docs/faq and #docs/faq/installing`, passing `"faq"` to the action in the first case, and passing `"faq"` and `"installing"` to the action in the second.
> 
> Trailing slashes are treated as a part of the URL, and (correctly) treated as a unique route when accessed. `docs` and `docs/` will fire different callbacks. If you can't avoid generating both types of URLs, you can define a `"docs(/)"` matcher to capture both cases.
>
> --
>
> **Note** that in some cases you cannot describe embedded routings, because it's not always clear how the routing table must behave. For example: 
> 
> ```javascript
> Router
    .to('/docs/:section(/:subsection)')
    .add('/about', function () {
        // unreachable route
    });
> ```

* **callback function** - function that will be called by a certain URL. Parameters of URL and `query string` are taken as parameters. The means of transmission depends on [**config**](#config), that is, whether they will be transmitted as a single object with keys according to the parameters names, or as a sequence of parameters (`query string` in this case is **always** transmitted as the last parameter). You may also set the controlling function `complete` as one of the parameters of the callback function - in this case the router will execute the routing of this record asynchronously (see [**complete**](#complete)).
* <a name="options"></a>**options** - is an object that may contain 2 attributes: `alias: sting` and `async: integer`. `alias` is for deleting the record from the routing table and grouping. `async` is a service parameter for designation of the ordinal number of the controlling function `complete` in the parameters by **dependency injection**. Used by minimization of the source data of a project, because names of variables are lost in the process.
> Note that the same `alias` can be added to any number of records. That's why, deleting it from the table, you will delete all records with this particular `alias`, see [**remove**](#remove).

For example, a full record may look like this:

```javascript
Router
	.add('docs/:id', function (param, complete){
		// todo
		complete();
	}, {alias: 'docs', async: 1}).
	add('docs/new', function (param) {
		//todo
	}, {alias: 'docs'});
```
In this case parameters (id and query string, if they are packed as one object) will be transmitted as 1 parameter of callback functions, `complete` as the second parameter of the first callback. If you delete `alias: 'docs'`, the whole group will be deleted as well.

###<a name="default"></a>default route
There is an option of adding **default route** for any routing level. To do that, you only need to add a callback function without the first parameter.

```javascript
Roure.add(callback, options);
```

This callback will always fire unless there is a coincidence with the previously registered routes.

> Note: **default route** must be added as the last route on the level, because all the routes that will be added afterwards, will not be processed. Besides, if you don't write a path for **default route**, neither parameters nor `query string` proceed to the callback.

###<a name="to"></a>to
Moves to the embedded level of the router; if it was not registered, then creates it and restores the subrouter for the basic `path`.

```javascript
var sectionRouter = Router
    .to('/docs/:section')
    .add('/about', function () {
        // unreachable route
    });
```

The number of embedded levels of routing is unlimited. If you call `to` once, you create a singleton of the subrouter, and further on, for example, in other fiels, you can register subpaths with `to`.

###<a name="remove"></a>remove
Removes a record in the routing table:

```javascript
Router.remove('/docs/:section');
```
As a parameter you may transmit `path`, `alias`, or `callback`; the corresponding record will be removed from the table.
 
>Note that the removal happens downwards the routing levels.
>Removal with `alias` will delete the whole group that is registered on it.

###<a name="async"></a><a name="complete"></a> `complete` function
The router can work with asynchronous functionality in callback functions, in order for embedded callbacks to fire after the response of the basic callback.
For this purpose you must name `complete` as one of the parameters, and after the execution of the asynchronous code you must call it. In this case, if you add a record to the routing table, the router will know the asynchrony, and the embedded routers will be executed only after you call `complete();`

```javascript
Route.add(path, function (complete){
	// your code
	complete(parameter);
}, options)
```
It's possible to transmit **false** as a `parameter`; in this case will fire an automatic [`rollback`](#rollback) on the URL, from which you move; further embedded callbacks will not be called. If everything is correct, you will not have to transmit any parameters `complete();`.

> If you minificate your code, you have to consider that both minificator and obfuscator, as a rule, change their names, and in this case you need to indicate the parameter number of `complete` in options (see [options](#options)), because **dependency injection** is based on the name of `complete`.

###<a name="rollback"></a>rollback
Rollback functionality allows to restore the URL to the state that was **before** the transmission, without executing callback methods for the previous URL.

Basically, rollback functionality consists of two parts: changing the URL of the browser and stopping the embedded callbacks.
In order to use `rollback` in the case of synchronous execution, you need to restore **false** from the callback function. In case of asynchronous execution you need to transfer **false** in `complete(false)`.
  
>If you call `rollback` by the first fire of the router, then as a URL, the router will move to an empty line `''`, and if **default route** is registered, then will move to it afterwards.