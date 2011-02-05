Components.utils.import('resource://gre/modules/ctypes.jsm');

const EXPORTED_SYMBOLS = ['Framework'];

function Framework(name) {
	if (! name)
		throw Error('Framework must be initialized with a name');
		
	this._path = '/System/Library/Frameworks/' + name + '.framework/' + name;
};

Framework.prototype = {
	_library: null,
	_path: null,
	_functions: {},
	
	get library() {
		if (this._library !== null)
			return this._library;
		else if (this._path === null)
			throw Error('No _path defined for Framework');
		else
			return this._library = ctypes.open(this._path);
	},

	declare: function(name, abi) {
		var declareArgs = arguments;
		this.__defineGetter__(name,
			function() {
				if (this._functions[name] !== undefined)
					return this._functions[name];
				else
					return this._functions[name] = this.library.declare.apply(this.library, declareArgs);
			});
	},

	close: function () {
		if (this._library !== null) {
			this._library.close();
			this._library = null;
			this._functions = {};
		}
	},
};