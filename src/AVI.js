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
	 * @param {Array.<number>} arr 
	 */
	Buffer.prototype.appendArray = function(arr) {
		this.buffer.push.apply(this.buffer, arr);
	};
	
	/**
	 * @param {number} idx
	 * @param {number} num 
	 */
	Buffer.prototype.writeShort = function(idx, num) {
		this.buffer[idx] = num & 255;
		this.buffer[idx + 1] = (num >> 8) & 255;
	};
	
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
	 * @param {number} num 
	 */
	Buffer.prototype.writeLong = function(idx, num) {
		this.buffer[idx] = num & 255;
		this.buffer[idx + 1] = (num >> 8) & 255;
		this.buffer[idx + 2] = (num >> 16) & 255;
		this.buffer[idx + 3] = (num >> 24) & 255;
		this.buffer[idx + 4] = 0;
		this.buffer[idx + 5] = 0;
		this.buffer[idx + 6] = 0;
		this.buffer[idx + 7] = 0;
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
	 * @param {string} id
	 */
	function Chunk(id) {
		this.id = id;
		this.data = new Buffer();
	};
	
	Chunk.prototype.getBuffer = function() {
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
	function List(type) {
		this.type = type;
		this.elements = [];
	};
	
	List.prototype.getBuffer = function() {
		var buffer = new Buffer();
		buffer.writeString(0, 'LIST');
		buffer.writeString(8, this.type);
		
		var len = 4;
		for (var i=0; i < this.elements.length; ++i) {
			var buf = this.elements[i].getBuffer();
			buffer.writeBuffer(len + 8, buf);
			len += buf.length;
		}
		
		buffer.writeInt(4, len);
		return buffer;
	};
	
	/**
	 * @constructor 
	 */
	function AVIJS() {
		this.settings = {
			width: 5,
			height: 5,
			framesPerSecond: 20
		};
		
		this.streams = [];
	};
	
	AVIJS.prototype.getBuffer = function() {
		var buffer = new Buffer();
		buffer.writeString(0, 'RIFF');
		buffer.writeString(8, 'AVI ');
		var len = 4;
		var frames = 0;
		for (var i=0; i < this.streams.length; ++i) {
			frames += this.streams[i].frames.length;
		}
		
		var hdrl = new List('hdrl');
		var avih = new Chunk('avih');
		avih.data.writeInt(0, 66665);
		avih.data.writeInt(4, 0); // MaxBytesPerSec
		avih.data.writeInt(8, 1); // Padding (in bytes)
		avih.data.writeInt(12, 0); // Flags
		avih.data.writeInt(16, frames); // Total Frames
		avih.data.writeInt(20, 0); // Initial Frames
		avih.data.writeInt(24, this.streams.length); // Total Streams
		avih.data.writeInt(28, 0); // Suggested Buffer size
		avih.data.writeInt(32, this.settings.width); // pixel width
		avih.data.writeInt(36, this.settings.height); // pixel height
		avih.data.writeInt(40, 0); // Reserved int[4]
		avih.data.writeInt(44, 0);
		avih.data.writeInt(48, 0);
		avih.data.writeInt(52, 0);
		hdrl.elements.push(avih);
		
		for (var i=0; i < this.streams.length; ++i) {
			hdrl.elements.push(this.streams[i].getHeaderBuffer());
		}
		var hdrlBuf = hdrl.getBuffer();
		buffer.writeBuffer(8 + len, hdrlBuf);
		len += hdrlBuf.length;
		
		var movi = new List('movi');
		for (var i=0; i < this.streams.length; ++i) {
			movi.elements.push(this.streams[i].getDataBuffer(i));
		}
		
		var moviBuf = movi.getBuffer();
		buffer.writeBuffer(8 + len, moviBuf);
		len += moviBuf.length;
		
		buffer.writeInt(4, len);
		return buffer.toString();
	};
	
	/**
	 * @constructor
 	 * @param {number} fps
	 */
	AVIJS.Stream = function(fps, width, height) {
		this.fps = fps;
		this.width = width;
		this.height = height;
		this.frames = [];
	};
	
	AVIJS.Stream.prototype.addFrame = function(imgData) {
		var frame = [];
		for (var i=0; i < imgData.length; i += 4) {
			frame.push(imgData[i], imgData[i+1], imgData[i+2],0);
		}
		this.frames.push(frame);
	};
	
	AVIJS.Stream.prototype.getHeaderBuffer = function() {
		var list = new List('strl');
		var strh = new Chunk('strh');
		strh.data.writeString(0, 'vids'); // fourCC
		strh.data.writeInt(4, 0); // Uncompressed
		strh.data.writeInt(8, 0); // Flags
		strh.data.writeShort(12, 1); // Priority
		strh.data.writeShort(14, 0); // Language
		strh.data.writeInt(16, 0); // Initial frames
		strh.data.writeInt(20, 1); // Scale
		strh.data.writeInt(24, this.fps); // Rate
		strh.data.writeInt(28, 0); // Startdelay
		strh.data.writeInt(32, 0); // Length
		strh.data.writeInt(36, 0); // suggested buffer size
		strh.data.writeInt(40, -1); // quality
		strh.data.writeInt(44, 0); // sampleSize
		strh.data.writeInt(48, 0); // Rect left
		strh.data.writeInt(52, 0); // Rect top
		strh.data.writeInt(56, this.width); // Rect width
		strh.data.writeInt(60, this.height); // Rect height
		list.elements.push(strh);
		
		var strf = new Chunk('strf');
		strf.data.writeLong(0, this.width); // width
		strf.data.writeLong(8, this.height); // height
		strf.data.writeShort(16, 1); // planes
		strf.data.writeShort(18, 32); // bits per pixel
		strf.data.writeInt(20, 0); // compression
		strf.data.writeInt(24, 0); // image size
		strf.data.writeLong(28, 0); // x pixels per meter
		strf.data.writeLong(36, 0); // y pixels per meter
		strf.data.writeInt(44, 0); // colortable used
		strf.data.writeInt(48, 0); // colortable important
		list.elements.push(strf);
		
		return list;
	};
	
	AVIJS.Stream.prototype.getDataBuffer = function(idx) {
		var chk = new Chunk((idx < 10 ? '0' + idx : idx) + 'db');
		for (var i=0; i < this.frames.length; ++i) {
			chk.data.appendArray(this.frames[i]);
		}
		return chk;
	};
	
	window['AVIJS'] = AVIJS;
})();