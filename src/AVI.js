"use strict";

(function() {
	
	/**
	 * A simple buffer to abstract data types away
	 * 
	 * @constructor
	 * @param {Array.<number>=} arr 
	 */
	function Buffer(arr) {
		this.buffer = arr ? arr : [];
		
	}
	Object.defineProperty(Buffer.prototype, 'length', {get: function() { return this.buffer.length; },
	                               		   			   enumerable : false}); 
	
	/**
	 * @param {number} idx
	 * @param {number} num 
	 */
	Buffer.prototype.writeInt = function(idx, num) {
		this.buffer[idx] = num & 255;
		this.buffer[idx + 1] = (num >> 8) & 255;
		this.buffer[idx + 2] = (num >> 16) & 255;
		this.buffer[idx + 3] = (num >> 24) & 255;
	};
	
	/**
	 * @param {number} idx
	 * @param {string} str 
	 */
	Buffer.prototype.writeString = function(idx, str) {
		for (var i=0; i < str.length; ++i) {
			this.buffer[idx + i] = str.charCodeAt(i) & 255;
		}
	};
	
	/**
	 * @param {number} idx
	 * @param {Buffer} buf 
	 */
	Buffer.prototype.writeBuffer = function(idx, buf) {
		for (var i=0; i < buf.length; ++i) {
			this.buffer[idx + i] = buf.buffer[i];
		}
	};
	
	Buffer.prototype.toString = function() {
		return String.fromCharCode.apply(null, this.buffer);
	};
	
	/**
	 * @constructor 
	 */
	function AVIJS() {
		this.settings = {
			width: 5,
			height: 5,
			frames: 0,
			streams: 0
		};
	};
	
	AVIJS.prototype.getBuffer = function() {
		var buffer = new Buffer();
		buffer.writeString(0, 'RIFF');
		buffer.writeString(8, 'AVI ');
		var len = 0;
		
		var avih = new AVIJS.Chunk('avih');
		avih.data.writeInt(0, 66665);
		avih.data.writeInt(4, 0); // MaxBytesPerSec
		avih.data.writeInt(8, 1); // Padding (in bytes)
		avih.data.writeInt(12, 0); // Flags
		avih.data.writeInt(16, this.settings.frames); // Total Frames
		avih.data.writeInt(20, 0); // Initial Frames
		avih.data.writeInt(24, this.settings.streams); // Total Streams
		avih.data.writeInt(28, 0); // Suggested Buffer size
		avih.data.writeInt(32, this.settings.width); // pixel width
		avih.data.writeInt(36, this.settings.height); // pixel height
		avih.data.writeInt(40, 0); // Reserved int[4]
		avih.data.writeInt(44, 0);
		avih.data.writeInt(48, 0);
		avih.data.writeInt(52, 0);
		//TODO: Write main header
		
		var hdrl = new AVIJS.List('hdrl');
		hdrl.elements.push(avih);
		
		var hdrlBuf = hdrl.getBuffer();
		buffer.writeBuffer(12, hdrlBuf);
		len += hdrlBuf.length;
		
		
		var movi = new AVIJS.List('movi');
		var moviBuf = movi.getBuffer();
		buffer.writeBuffer(12 + len, moviBuf);
		len += moviBuf.length;
		
		buffer.writeInt(4, len);
		return buffer.toString();
	}
	
	/**
	 * @constructor
	 * @param {string} id
	 */
	AVIJS.Chunk = function(id) {
		this.id = id;
		this.data = new Buffer();
	};
	
	AVIJS.Chunk.prototype.getBuffer = function() {
		var buffer = new Buffer();
		buffer.writeString(0, this.id);
		buffer.writeInt(4, this.data.length);
		buffer.writeBuffer(8, this.data);
		return buffer;
	};
	
	/**
	 * @constructor
 	 * @param {string} type
	 */
	AVIJS.List = function(type) {
		this.type = type;
		this.elements = [];
	};
	
	AVIJS.List.prototype.getBuffer = function() {
		var buffer = new Buffer();
		buffer.writeString(0, 'LIST');
		buffer.writeString(8, this.type);
		
		var len = 0;
		for (var i=0; i < this.elements.length; ++i) {
			var buf = this.elements[i].getBuffer();
			buffer.writeBuffer(len + 12, buf);
			len += buf.length;
		}
		
		buffer.writeInt(4, len);
		return buffer;
	};
	
	window.AVIJS = AVIJS;
})();