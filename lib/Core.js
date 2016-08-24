if(typeof window != 'undefined') {
    global = window;
}

/**
 * @global
 * @name __inline_debug__
 */
try {
    global.__defineSetter__('__inline_debug__', function(value) {
        var e = new Error;
        console.log(value);
        console.log(e.stack ? e.stack.split("\n").slice(3).join("\n") : 'no stack provided');
    });
} catch(e) {
    // игнорируем - defineSetter не поддерживается
}

Core = {
      __event_stack: []
    , _eventsTracking: 0
    , _eventsTrackingObjects: []
    , log: (function() {
        var a = [];
        a.__proto__ = { __proto__: a.__proto__, push: function() {
            Array.prototype.push.apply(this, arguments);
            while (this.length > 200) {
                this.shift();
            }
            if( this._eventsTracking ) {
                console.log(Array.prototype.map(arguments, function(v) {return v}))
            }
        }};
        return a;
    })()
    , EnableEventsTracking: function() {
        this._eventsTracking = true;
    }
    , DisableEventsTracking: function() {
        this._eventsTracking = false;
    }
    , EventPoint: function() {
            function event(data) {
                if (arguments.length > 1) {
                    console.error('we does not support events with big number of arguments. only 1 or nothing.');
                }
                if (data) {
                    for (var i in data) {
                        this[i] = data[i];
                    }
                }
                if (Core._eventsTracking) {
                    console.log(event._event, data)
                }
                this._event = event._event;
            }

            event.listeners = [];
            return event;
        }
    , RequestPoint: function() {
        function request(data, cb, fail_cb) {
            var i;
            if(data) {
                for(i in data) {
                    this[i] = data[i];
                }
            }
            this._request = request._request;
        }
        request.listeners = [];
        return request;
    }
    , _contexts: []
    , globalContext: {}
    , fetchContext: function() {
        if(!this._contexts.length) {
            throw new Error('Cannot fetch context not in CatchEvent or CatchRequest call');
        }
        return this._contexts[0]
    }
    , getStack: function(e) {
//        return new (function stack() {
            return (e || new Error()).stack.replace(/^ +at /mg, '').split(/\n/).slice(3).filter(function(string) {
                return !string.match(/^(Object\.Core\.)?Fire(Event|Request)/);
            })
//        })
    }
    , FireEvent: function(event, /** optional */ context ) {

        //event.__proto__ = {__proto__: event.__proto__, stack: Core.getStack()};

        if(event instanceof Function) {
            console.log(event);
            throw new Error('Trying to fire not object, but Function');
        }

        this._contexts.unshift(context);

        var listeners = event.constructor.listeners;

        if(!event.constructor.options || event.constructor.options.log !== false) {
            this.log.push(event);
        }

        var methods = [];

        for(var i = 0; i < listeners.length; i++) {
            var handler = listeners[i];
            Core.__event_stack.unshift(event);

            try {
                (handler[1] instanceof Function ? (handler[1]) : handler[0][handler[1]] ).apply(handler[0], handler[2]);
                methods.push(handler[1])
            } catch (e) {
                methods.push('error: ', handler[1]);
                console.error(event, handler[1], [e.stack ? e.message : e, e.stack ? e.stack.split("\n").slice(2).join("\n") : 'no stack provided']);
            }

            Core.__event_stack.shift();
        }
        if(!event.constructor.options || event.constructor.options.log !== false) {
            this.log.push(methods);
        }

        this._contexts.shift(context)
    }
    , FireRequest: function(request, cb, fail_cb, /** optional */context) {

        //request.__proto__ = {__proto__: request.__proto__, stack: Core.getStack()};

        if(request instanceof Function) {
            throw new Error('Trying to fire not object, but Function');
        }

        this._contexts.unshift(context);

        if(!request.constructor.options || request.constructor.options.log !== false) {
            this.log.push(request);
        }

        var _this = request;

        _this._cb      = cb;
        _this._fail_cb = fail_cb;

        if(!_this._started) {
            _this._started = true;
            if(global[_this._request + '_Start']) {
                var StartEvent = new global[_this._request + '_Start']();
                StartEvent.__proto__ = {__proto__: StartEvent.__proto__, request: _this}
                FireEvent(StartEvent)
            }
        }

        var methods = [];

        var handlers = [], listeners = request.constructor.listeners;
        for(var i in listeners) {
            Core.__event_stack.unshift(_this);
            try {
                var handler = listeners[i][0][listeners[i][1]](listeners[i][2]);
                if(handler) {
                    handlers.push([listeners[i][1], handler]);
                }
            } catch (e) {
                console.log(e.message);
                if(e.stack) {
                    console.log(this.getStack(e));
                }
            }
            Core.__event_stack.shift();
        }

        if(!request.constructor.options || request.constructor.options.log !== false) {
            this.log.push(methods);
        }

        this._contexts.shift(context);

        var handlers_results = [];

        function run_handler() {
            var handler = handlers.shift();
            if(handler) {
                handlers_results.push(handler[0]);
                handler[1](function(result) {
                    var data = {
                        result: result
                    };

                    if(_this._reqid) {
                        data._reqid = _this._reqid
                    }
                    if(!_this._handled) {
                        _this._handled = true;

                        var SuccessEvent = new global[request._request + '_Success'](data);
                        SuccessEvent.__proto__ = {__proto__: SuccessEvent.__proto__, request: request};
                        FireEvent(SuccessEvent);
                    }

                    handlers_results.push(result);

                    _this._cb && _this._cb(result);
                }, handler.name != 'success' ? run_handler: new Function);
            } else {
                var data = {};
                if(_this._reqid) {
                    data._reqid = _this._reqid
                }
                if(!_this._handled) {
                    _this._handled = true;
                    var FailEvent = new global[request._request + '_Fail'](data);
                    FailEvent.__proto__ = {__proto__: FailEvent.__proto__, request: request};
                    FireEvent(FailEvent);
                }
                _this._fail_cb instanceof Function && _this._fail_cb();
            }
        }

        if(cb || fail_cb) {
            run_handler()
        } else {
            _this._run_handler = run_handler;
            run_handler()
        }

        if(!request.constructor.options || request.constructor.options.log !== false) {
            Core.log.push(handlers_results);
        }
    }
    , contextMatches: function checkRecursive(context, pattern) {
        for( var i in pattern ) {
            if( pattern.hasOwnProperty(i) ) {
                if( typeof pattern[i] != "object" ) {
                    if( pattern[i] != context[i] ) {
                        return false;
                    }
                } else if(pattern[i] instanceof Array) {
                    // наверное, будем сравнивать поэлементно?
                    // пока пропущу
                    throw new Error('Comparation of Arrays is not realized yet. P.S. Dear developer, please, select preferred model and realize.');
                } else {
                    if( !context[i] || !checkRecursive(context[i], pattern[i]) ) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    , _clone: function(obj, to) {
        if(obj) {
            for(var i in obj) {
                if(obj.hasOwnProperty(i)) {
                    to[i] = obj[i];
                }
            }
        }

    }
    , registerEventPoint: function(name, options) {

        if(global[name] instanceof Core.EventPoint) return;

        eval('var eventConstructor = function ' + name + '(data) { \n' +
        '   Core._clone(data, this); \n' +
        '   this._event = ' + name + '._event; \n' +
        '}');

        eventConstructor.prototype = {__proto__: options && options.parent || Core.EventPoint.prototype, constructor: eventConstructor};
        eventConstructor.listeners = [];
        eventConstructor._event    = name;
        eventConstructor.options   = options;

        global[name] = eventConstructor;
    }
    , registerRequestPoint: function(name, options) {

        if(global[name] instanceof Core.RequestPoint) return;

        eval('var requestConstructor = function ' + name + '(data) { \n' +
        '   Core._clone(data, this); \n' +
        '   this._request = ' + name + '._request; \n' +
        '}');

        requestConstructor.prototype = {__proto__: options && options.parent || Core.RequestPoint.prototype, constructor: requestConstructor};
        requestConstructor._request  = name;
        requestConstructor.listeners = [];
        requestConstructor.options   = options;

        global[name] = requestConstructor;

        this.registerEventPoint(name + '_Start'  , {log: false});
        this.registerEventPoint(name + '_Success', {log: !options || options.log});
        this.registerEventPoint(name + '_Fail'   , {log: !options || options.log});
    }
    , _namespaces: {}
    , getNamespace: function(namespace) {
        if(!this._namespaces[namespace]) {
            this._namespaces[namespace] = new function(){
                this.processNamespace = function() {
                    Core.processNamespace(this);
                }
            };
        }
        return this._namespaces[namespace];
    }
    , processNamespace: function(namespace) {
        for(var _classname in namespace) {
            var _class = namespace[_classname];
            if (typeof _class !== 'object' || !_class)
                continue;
            if (_class.hasOwnProperty('__inited__'))
                continue;
            if (_class.__init instanceof Function) {
                _class.__init();
            }
            for(var method in _class) {
                var events;
                if (_class[method] instanceof Function) {
                    if (events = _class[method].toString().replace(/\n/g,"").match(/(Core\.)?(CatchEvent|CatchRequest)\(([^\)]+)\)/m)) {
                        events = events[3].replace(/^[ \t]*|[ \t]*$/g,"").split(/[ \t\n\r]*,[ \t\n\r]*/);
                        for(var i in events) {
                            try {
                                var parts = events[i].split('.');
                                var cursor = global;
                                for(var n in parts) {
                                    cursor = cursor[parts[n]];
                                }
                                cursor.listeners.push([_class, method]);

                                if( _class[method].toString().indexOf('CatchEvent') > -1 ) {
                                    cursor._event   = events[i];
                                } else if( _class[method].toString().indexOf('CatchRequest') > -1 ) {
                                    cursor._request = events[i];
                                }
                            } catch(e) {
                                console.error('cannot parse ' + events[i] + ' in CatchEvent in [namespace].' + _classname + '.' + method, e.stack ? e.message : e, e.stack ? e.stack : 'no stack provided');
                            }
                        }
                    }
                }
            }
            if(_class.Init) {
                try {
                    FireEvent(new _class.Init);
                } catch(e) {
                    console.error(e.stack ? e.message : e, e.stack ? e.stack : 'no stack provided');
                }
            }
            if( Object.defineProperty && Object.getOwnPropertyDescriptor(_class, '__inited__') && Object.getOwnPropertyDescriptor(_class, '__inited__').writable !== false ) {
                Object.defineProperty(_class, '__inited__', { value: true});
            } else {
                _class.__inited__ = true
            }
        }
    }
    , processObject: function(object) {
        var _class = object;

        if( _class.__inited__ )
            return;
        if( _class.__init instanceof Function ) {
            _class.__init();
        }
        for( var method in _class ) {
            var events;
            if( _class[method] instanceof Function ) {
                if( events = _class[method].toString().replace(/\n/g,"").match(/(Core\.)?(CatchEvent|CatchRequest)\(([^\)]+)\)/m) ) {
                    events = events[3].replace(/^[ \t\n\r]*|[ \t\n\r]*$/mg,"").split(/[ \t\n\r]*,[ \t\n\r]*/);
                    for( var i in events ) {
                        try {
                            var parts = events[i].split('.');
                            var cursor = global;
                            for(var n in parts) {
                                cursor = cursor[parts[n]];
                            }
                            cursor.listeners.push([_class, method]);

                            if( _class[method].toString().indexOf('CatchEvent') > -1 ) {
                                cursor._event   = events[i];
                            } else if( _class[method].toString().indexOf('CatchRequest') > -1 ) {
                                cursor._request = events[i];
                            }
                        } catch(e) {
                            console.error('cannot parse ' + events[i] + ' in [namespace].' + '.' + method, e.stack ? e.message : e, e.stack ? e.stack : 'no stack provided');
                        }
                    }
                }
            }
        }
        if( _class.Init ) {
            try {
                FireEvent(new _class.Init);
            } catch(e) {
                console.error(e.stack ? e.message : e, e.stack ? e.stack : 'no stack provided');
            }
        }
        _class.__inited__ = true;

        return object;
    }
    , CatchEvent:   function() { return Core.__event_stack[0]; /* supress no arguments warning */ arguments;}
    , CatchRequest: function() { return Core.__event_stack[0]; /* supress no arguments warning */ arguments;}
    , state: function() {
        if(!arguments.length) {
            throw new Error('no states defined');
        }
        var args = arguments;
        var o = {
            Changed: new Core.EventPoint(),
            value: args[0],
            addCssTrigger: function(selector, prefix) {
                o.cssTrigger = selector;
                o.cssTriggerPrefix = prefix || '';
                jQuery(function() {
                    jQuery(o.cssTrigger).addClass(o.cssTriggerPrefix + o.value);
                });
                return o;
            },
            go: function(state) {
                if(!o["Go" + state]) {
                    throw new Error('wrong state ' + state);
                }
                var from = o.value;
                o.value = state;
                if(o.cssTrigger) {
                    for(var i = 0; i < args.length; i++) {
                        jQuery(o.cssTrigger).removeClass(o.cssTriggerPrefix + args[i]);
                    }
                    jQuery(o.cssTrigger).addClass(o.cssTriggerPrefix + state);
                }
                setTimeout( function() {
                    FireEvent(new o.Changed({from: from, to: state}));
                    FireEvent(new o["Go" + state]({from: from}));
                }, 0);
            }
        };
        for(var i = 0; i < args.length; i++) {
            o["Go" + args[i]] = new Core.EventPoint();
        }
        return o;
    }
    , stack: function() {
        var stack = [];

        for(var i = 0 ; i < arguments.length; i++) {
            stack[i] = arguments[i];
        }

        stack.set = function(layer_num, name, data) {
            this[layer_num] = [name, data];
            this.splice(layer_num + 1);
        };

        return stack;
    }
};

if(typeof window != 'undefined') {
    /** @name  Event_DOM_Init */
    Core.registerEventPoint('Event_DOM_Init');
    /** @name  Event_DOM_Unload */
    Core.registerEventPoint('Event_DOM_Unload');

    /** @name  Event_Window_Scroll */
    Core.registerEventPoint('Event_Window_Scroll');
    /** @name  Event_Window_Resize */
    Core.registerEventPoint('Event_Window_Resize');

    // cross-browser DOM_Ready
    (function contentLoaded(win, fn) {

        var done = false, top = true,

            doc = win.document, root = doc.documentElement,

            add = doc.addEventListener ? 'addEventListener' : 'attachEvent',
            rem = doc.addEventListener ? 'removeEventListener' : 'detachEvent',
            pre = doc.addEventListener ? '' : 'on',

            init = function(e) {
                if (e.type == 'readystatechange' && doc.readyState != 'complete') return;
                (e.type == 'load' ? win : doc)[rem](pre + e.type, init, false);
                if (!done && (done = true)) fn.call(win, e.type || e);
            },

            poll = function() {
                try { root.doScroll('left'); } catch(e) { setTimeout(poll, 50); return; }
                init('poll');
            };

        if (doc.readyState == 'complete') fn.call(win, 'lazy');
        else {
            if (doc.createEventObject && root.doScroll) {
                try { top = !win.frameElement; } catch(e) { }
                if (top) poll();
            }
            doc[add](pre + 'DOMContentLoaded', init, false);
            doc[add](pre + 'readystatechange', init, false);
            win[add](pre + 'load', init, false);
        }

    })(window, function core_events_list(e){
        var old_onscroll, old_onresize;
        if(window.onscroll || document.body.onscroll) {
            old_onscroll = window.onscroll || document.body.onscroll;
        }
        if(window.onresize || document.body.onresize) {
            old_onresize = window.onresize || document.body.onresize;
        }

        Core.FireEvent(new Event_DOM_Init(e));
        window.onscroll = document.body.onscroll = function(event) {
            if(old_onscroll) {
                old_onscroll(event);
            }
            Core.FireEvent(new Event_Window_Scroll(event));
        };
        window.onresize = document.body.onresize = function(event) {
            if(old_onresize) {
                old_onresize(event);
            }
            Core.FireEvent(new Event_Window_Resize(event));
        };

        window.onbeforeunload = function(event) {
            Core.FireEvent(new Event_DOM_Unload(event));
        };

    });
}

if(typeof global.Event == 'undefined' ) {
    global.Event = {};
}

if(typeof require != 'undefined') {
    module.exports = Core;
}

CatchEvent = function(){ return Core.CatchEvent.apply(Core, arguments); };
CatchRequest = function(){ return Core.CatchRequest.apply(Core, arguments); };
FireRequest = function(){ return Core.FireRequest.apply(Core, arguments); };
FireEvent = function(){ return Core.FireEvent.apply(Core, arguments); };
EventPoint = Core.EventPoint;
