import { n as __esmMin, r as __exportAll } from "../_runtime.mjs";
//#region node_modules/iobuffer/lib-esm/text.js
function decode(bytes, encoding = "utf8") {
	return new TextDecoder(encoding).decode(bytes);
}
function encode(str) {
	return encoder.encode(str);
}
var encoder;
var init_text$1 = __esmMin((() => {
	encoder = new TextEncoder();
}));
//#endregion
//#region node_modules/iobuffer/lib-esm/IOBuffer.js
var defaultByteLength, hostBigEndian, typedArrays, IOBuffer;
var init_IOBuffer = __esmMin((() => {
	init_text$1();
	defaultByteLength = 1024 * 8;
	hostBigEndian = (() => {
		const array = /* @__PURE__ */ new Uint8Array(4);
		const view = new Uint32Array(array.buffer);
		return !((view[0] = 1) & array[0]);
	})();
	typedArrays = {
		int8: globalThis.Int8Array,
		uint8: globalThis.Uint8Array,
		int16: globalThis.Int16Array,
		uint16: globalThis.Uint16Array,
		int32: globalThis.Int32Array,
		uint32: globalThis.Uint32Array,
		uint64: globalThis.BigUint64Array,
		int64: globalThis.BigInt64Array,
		float32: globalThis.Float32Array,
		float64: globalThis.Float64Array
	};
	IOBuffer = class IOBuffer {
		/**
		* Reference to the internal ArrayBuffer object.
		*/
		buffer;
		/**
		* Byte length of the internal ArrayBuffer.
		*/
		byteLength;
		/**
		* Byte offset of the internal ArrayBuffer.
		*/
		byteOffset;
		/**
		* Byte length of the internal ArrayBuffer.
		*/
		length;
		/**
		* The current offset of the buffer's pointer.
		*/
		offset;
		lastWrittenByte;
		littleEndian;
		_data;
		_mark;
		_marks;
		/**
		* Create a new IOBuffer.
		* @param data - The data to construct the IOBuffer with.
		* If data is a number, it will be the new buffer's length<br>
		* If data is `undefined`, the buffer will be initialized with a default length of 8Kb<br>
		* If data is an ArrayBuffer, SharedArrayBuffer, an ArrayBufferView (Typed Array), an IOBuffer instance,
		* or a Node.js Buffer, a view will be created over the underlying ArrayBuffer.
		* @param options - An object for the options.
		* @returns A new IOBuffer instance.
		*/
		constructor(data = defaultByteLength, options = {}) {
			let dataIsGiven = false;
			if (typeof data === "number") data = new ArrayBuffer(data);
			else {
				dataIsGiven = true;
				this.lastWrittenByte = data.byteLength;
			}
			const offset = options.offset ? options.offset >>> 0 : 0;
			const byteLength = data.byteLength - offset;
			let dvOffset = offset;
			if (ArrayBuffer.isView(data) || data instanceof IOBuffer) {
				if (data.byteLength !== data.buffer.byteLength) dvOffset = data.byteOffset + offset;
				data = data.buffer;
			}
			if (dataIsGiven) this.lastWrittenByte = byteLength;
			else this.lastWrittenByte = 0;
			this.buffer = data;
			this.length = byteLength;
			this.byteLength = byteLength;
			this.byteOffset = dvOffset;
			this.offset = 0;
			this.littleEndian = true;
			this._data = new DataView(this.buffer, dvOffset, byteLength);
			this._mark = 0;
			this._marks = [];
		}
		/**
		* Checks if the memory allocated to the buffer is sufficient to store more
		* bytes after the offset.
		* @param byteLength - The needed memory in bytes.
		* @returns `true` if there is sufficient space and `false` otherwise.
		*/
		available(byteLength = 1) {
			return this.offset + byteLength <= this.length;
		}
		/**
		* Check if little-endian mode is used for reading and writing multi-byte
		* values.
		* @returns `true` if little-endian mode is used, `false` otherwise.
		*/
		isLittleEndian() {
			return this.littleEndian;
		}
		/**
		* Set little-endian mode for reading and writing multi-byte values.
		* @returns This.
		*/
		setLittleEndian() {
			this.littleEndian = true;
			return this;
		}
		/**
		* Check if big-endian mode is used for reading and writing multi-byte values.
		* @returns `true` if big-endian mode is used, `false` otherwise.
		*/
		isBigEndian() {
			return !this.littleEndian;
		}
		/**
		* Switches to big-endian mode for reading and writing multi-byte values.
		* @returns This.
		*/
		setBigEndian() {
			this.littleEndian = false;
			return this;
		}
		/**
		* Move the pointer n bytes forward.
		* @param n - Number of bytes to skip.
		* @returns This.
		*/
		skip(n = 1) {
			this.offset += n;
			return this;
		}
		/**
		* Move the pointer n bytes backward.
		* @param n - Number of bytes to move back.
		* @returns This.
		*/
		back(n = 1) {
			this.offset -= n;
			return this;
		}
		/**
		* Move the pointer to the given offset.
		* @param offset - The offset to move to.
		* @returns This.
		*/
		seek(offset) {
			this.offset = offset;
			return this;
		}
		/**
		* Store the current pointer offset.
		* @see {@link IOBuffer#reset}
		* @returns This.
		*/
		mark() {
			this._mark = this.offset;
			return this;
		}
		/**
		* Move the pointer back to the last pointer offset set by mark.
		* @see {@link IOBuffer#mark}
		* @returns This.
		*/
		reset() {
			this.offset = this._mark;
			return this;
		}
		/**
		* Push the current pointer offset to the mark stack.
		* @see {@link IOBuffer#popMark}
		* @returns This.
		*/
		pushMark() {
			this._marks.push(this.offset);
			return this;
		}
		/**
		* Pop the last pointer offset from the mark stack, and set the current
		* pointer offset to the popped value.
		* @see {@link IOBuffer#pushMark}
		* @returns This.
		*/
		popMark() {
			const offset = this._marks.pop();
			if (offset === void 0) throw new Error("Mark stack empty");
			this.seek(offset);
			return this;
		}
		/**
		* Move the pointer offset back to 0.
		* @returns This.
		*/
		rewind() {
			this.offset = 0;
			return this;
		}
		/**
		* Make sure the buffer has sufficient memory to write a given byteLength at
		* the current pointer offset.
		* If the buffer's memory is insufficient, this method will create a new
		* buffer (a copy) with a length that is twice (byteLength + current offset).
		* @param byteLength - The needed memory in bytes.
		* @returns This.
		*/
		ensureAvailable(byteLength = 1) {
			if (!this.available(byteLength)) {
				const newLength = (this.offset + byteLength) * 2;
				const newArray = new Uint8Array(newLength);
				newArray.set(new Uint8Array(this.buffer));
				this.buffer = newArray.buffer;
				this.length = newLength;
				this.byteLength = newLength;
				this._data = new DataView(this.buffer);
			}
			return this;
		}
		/**
		* Read a byte and return false if the byte's value is 0, or true otherwise.
		* Moves pointer forward by one byte.
		* @returns The read boolean.
		*/
		readBoolean() {
			return this.readUint8() !== 0;
		}
		/**
		* Read a signed 8-bit integer and move pointer forward by 1 byte.
		* @returns The read byte.
		*/
		readInt8() {
			return this._data.getInt8(this.offset++);
		}
		/**
		* Read an unsigned 8-bit integer and move pointer forward by 1 byte.
		* @returns The read byte.
		*/
		readUint8() {
			return this._data.getUint8(this.offset++);
		}
		/**
		* Alias for {@link IOBuffer#readUint8}.
		* @returns The read byte.
		*/
		readByte() {
			return this.readUint8();
		}
		/**
		* Read `n` bytes and move pointer forward by `n` bytes.
		* @param n - Number of bytes to read.
		* @returns The read bytes.
		*/
		readBytes(n = 1) {
			return this.readArray(n, "uint8");
		}
		/**
		* Creates an array of corresponding to the type `type` and size `size`.
		* For example type `uint8` will create a `Uint8Array`.
		* @param size - size of the resulting array
		* @param type - number type of elements to read
		* @returns The read array.
		*/
		readArray(size, type) {
			const bytes = typedArrays[type].BYTES_PER_ELEMENT * size;
			const offset = this.byteOffset + this.offset;
			const slice = this.buffer.slice(offset, offset + bytes);
			if (this.littleEndian === hostBigEndian && type !== "uint8" && type !== "int8") {
				const slice = new Uint8Array(this.buffer.slice(offset, offset + bytes));
				slice.reverse();
				const returnArray = new typedArrays[type](slice.buffer);
				this.offset += bytes;
				returnArray.reverse();
				return returnArray;
			}
			const returnArray = new typedArrays[type](slice);
			this.offset += bytes;
			return returnArray;
		}
		/**
		* Read a 16-bit signed integer and move pointer forward by 2 bytes.
		* @returns The read value.
		*/
		readInt16() {
			const value = this._data.getInt16(this.offset, this.littleEndian);
			this.offset += 2;
			return value;
		}
		/**
		* Read a 16-bit unsigned integer and move pointer forward by 2 bytes.
		* @returns The read value.
		*/
		readUint16() {
			const value = this._data.getUint16(this.offset, this.littleEndian);
			this.offset += 2;
			return value;
		}
		/**
		* Read a 32-bit signed integer and move pointer forward by 4 bytes.
		* @returns The read value.
		*/
		readInt32() {
			const value = this._data.getInt32(this.offset, this.littleEndian);
			this.offset += 4;
			return value;
		}
		/**
		* Read a 32-bit unsigned integer and move pointer forward by 4 bytes.
		* @returns The read value.
		*/
		readUint32() {
			const value = this._data.getUint32(this.offset, this.littleEndian);
			this.offset += 4;
			return value;
		}
		/**
		* Read a 32-bit floating number and move pointer forward by 4 bytes.
		* @returns The read value.
		*/
		readFloat32() {
			const value = this._data.getFloat32(this.offset, this.littleEndian);
			this.offset += 4;
			return value;
		}
		/**
		* Read a 64-bit floating number and move pointer forward by 8 bytes.
		* @returns The read value.
		*/
		readFloat64() {
			const value = this._data.getFloat64(this.offset, this.littleEndian);
			this.offset += 8;
			return value;
		}
		/**
		* Read a 64-bit signed integer number and move pointer forward by 8 bytes.
		* @returns The read value.
		*/
		readBigInt64() {
			const value = this._data.getBigInt64(this.offset, this.littleEndian);
			this.offset += 8;
			return value;
		}
		/**
		* Read a 64-bit unsigned integer number and move pointer forward by 8 bytes.
		* @returns The read value.
		*/
		readBigUint64() {
			const value = this._data.getBigUint64(this.offset, this.littleEndian);
			this.offset += 8;
			return value;
		}
		/**
		* Read a 1-byte ASCII character and move pointer forward by 1 byte.
		* @returns The read character.
		*/
		readChar() {
			return String.fromCharCode(this.readInt8());
		}
		/**
		* Read `n` 1-byte ASCII characters and move pointer forward by `n` bytes.
		* @param n - Number of characters to read.
		* @returns The read characters.
		*/
		readChars(n = 1) {
			let result = "";
			for (let i = 0; i < n; i++) result += this.readChar();
			return result;
		}
		/**
		* Read the next `n` bytes, return a UTF-8 decoded string and move pointer
		* forward by `n` bytes.
		* @param n - Number of bytes to read.
		* @returns The decoded string.
		*/
		readUtf8(n = 1) {
			return decode(this.readBytes(n));
		}
		/**
		* Read the next `n` bytes, return a string decoded with `encoding` and move pointer
		* forward by `n` bytes.
		* If no encoding is passed, the function is equivalent to @see {@link IOBuffer#readUtf8}
		* @param n - Number of bytes to read.
		* @param encoding - The encoding to use. Default is 'utf8'.
		* @returns The decoded string.
		*/
		decodeText(n = 1, encoding = "utf8") {
			return decode(this.readBytes(n), encoding);
		}
		/**
		* Write 0xff if the passed value is truthy, 0x00 otherwise and move pointer
		* forward by 1 byte.
		* @param value - The value to write.
		* @returns This.
		*/
		writeBoolean(value) {
			this.writeUint8(value ? 255 : 0);
			return this;
		}
		/**
		* Write `value` as an 8-bit signed integer and move pointer forward by 1 byte.
		* @param value - The value to write.
		* @returns This.
		*/
		writeInt8(value) {
			this.ensureAvailable(1);
			this._data.setInt8(this.offset++, value);
			this._updateLastWrittenByte();
			return this;
		}
		/**
		* Write `value` as an 8-bit unsigned integer and move pointer forward by 1
		* byte.
		* @param value - The value to write.
		* @returns This.
		*/
		writeUint8(value) {
			this.ensureAvailable(1);
			this._data.setUint8(this.offset++, value);
			this._updateLastWrittenByte();
			return this;
		}
		/**
		* An alias for {@link IOBuffer#writeUint8}.
		* @param value - The value to write.
		* @returns This.
		*/
		writeByte(value) {
			return this.writeUint8(value);
		}
		/**
		* Write all elements of `bytes` as uint8 values and move pointer forward by
		* `bytes.length` bytes.
		* @param bytes - The array of bytes to write.
		* @returns This.
		*/
		writeBytes(bytes) {
			this.ensureAvailable(bytes.length);
			for (let i = 0; i < bytes.length; i++) this._data.setUint8(this.offset++, bytes[i]);
			this._updateLastWrittenByte();
			return this;
		}
		/**
		* Write `value` as a 16-bit signed integer and move pointer forward by 2
		* bytes.
		* @param value - The value to write.
		* @returns This.
		*/
		writeInt16(value) {
			this.ensureAvailable(2);
			this._data.setInt16(this.offset, value, this.littleEndian);
			this.offset += 2;
			this._updateLastWrittenByte();
			return this;
		}
		/**
		* Write `value` as a 16-bit unsigned integer and move pointer forward by 2
		* bytes.
		* @param value - The value to write.
		* @returns This.
		*/
		writeUint16(value) {
			this.ensureAvailable(2);
			this._data.setUint16(this.offset, value, this.littleEndian);
			this.offset += 2;
			this._updateLastWrittenByte();
			return this;
		}
		/**
		* Write `value` as a 32-bit signed integer and move pointer forward by 4
		* bytes.
		* @param value - The value to write.
		* @returns This.
		*/
		writeInt32(value) {
			this.ensureAvailable(4);
			this._data.setInt32(this.offset, value, this.littleEndian);
			this.offset += 4;
			this._updateLastWrittenByte();
			return this;
		}
		/**
		* Write `value` as a 32-bit unsigned integer and move pointer forward by 4
		* bytes.
		* @param value - The value to write.
		* @returns This.
		*/
		writeUint32(value) {
			this.ensureAvailable(4);
			this._data.setUint32(this.offset, value, this.littleEndian);
			this.offset += 4;
			this._updateLastWrittenByte();
			return this;
		}
		/**
		* Write `value` as a 32-bit floating number and move pointer forward by 4
		* bytes.
		* @param value - The value to write.
		* @returns This.
		*/
		writeFloat32(value) {
			this.ensureAvailable(4);
			this._data.setFloat32(this.offset, value, this.littleEndian);
			this.offset += 4;
			this._updateLastWrittenByte();
			return this;
		}
		/**
		* Write `value` as a 64-bit floating number and move pointer forward by 8
		* bytes.
		* @param value - The value to write.
		* @returns This.
		*/
		writeFloat64(value) {
			this.ensureAvailable(8);
			this._data.setFloat64(this.offset, value, this.littleEndian);
			this.offset += 8;
			this._updateLastWrittenByte();
			return this;
		}
		/**
		* Write `value` as a 64-bit signed bigint and move pointer forward by 8
		* bytes.
		* @param value - The value to write.
		* @returns This.
		*/
		writeBigInt64(value) {
			this.ensureAvailable(8);
			this._data.setBigInt64(this.offset, value, this.littleEndian);
			this.offset += 8;
			this._updateLastWrittenByte();
			return this;
		}
		/**
		* Write `value` as a 64-bit unsigned bigint and move pointer forward by 8
		* bytes.
		* @param value - The value to write.
		* @returns This.
		*/
		writeBigUint64(value) {
			this.ensureAvailable(8);
			this._data.setBigUint64(this.offset, value, this.littleEndian);
			this.offset += 8;
			this._updateLastWrittenByte();
			return this;
		}
		/**
		* Write the charCode of `str`'s first character as an 8-bit unsigned integer
		* and move pointer forward by 1 byte.
		* @param str - The character to write.
		* @returns This.
		*/
		writeChar(str) {
			return this.writeUint8(str.charCodeAt(0));
		}
		/**
		* Write the charCodes of all `str`'s characters as 8-bit unsigned integers
		* and move pointer forward by `str.length` bytes.
		* @param str - The characters to write.
		* @returns This.
		*/
		writeChars(str) {
			for (let i = 0; i < str.length; i++) this.writeUint8(str.charCodeAt(i));
			return this;
		}
		/**
		* UTF-8 encode and write `str` to the current pointer offset and move pointer
		* forward according to the encoded length.
		* @param str - The string to write.
		* @returns This.
		*/
		writeUtf8(str) {
			return this.writeBytes(encode(str));
		}
		/**
		* Export a Uint8Array view of the internal buffer.
		* The view starts at the byte offset and its length
		* is calculated to stop at the last written byte or the original length.
		* @returns A new Uint8Array view.
		*/
		toArray() {
			return new Uint8Array(this.buffer, this.byteOffset, this.lastWrittenByte);
		}
		/**
		*  Get the total number of bytes written so far, regardless of the current offset.
		* @returns - Total number of bytes.
		*/
		getWrittenByteLength() {
			return this.lastWrittenByte - this.byteOffset;
		}
		/**
		* Update the last written byte offset
		* @private
		*/
		_updateLastWrittenByte() {
			if (this.offset > this.lastWrittenByte) this.lastWrittenByte = this.offset;
		}
	};
}));
//#endregion
//#region node_modules/pako/index.js
function deflate(data) {
	return data;
}
function inflate(data) {
	return data;
}
var Inflate;
var init_pako = __esmMin((() => {
	Inflate = class {
		constructor() {}
		push() {}
	};
}));
//#endregion
//#region node_modules/fast-png/lib-esm/helpers/crc.js
function updateCrc(currentCrc, data, length) {
	let c = currentCrc;
	for (let n = 0; n < length; n++) c = crcTable[(c ^ data[n]) & 255] ^ c >>> 8;
	return c;
}
function crc(data, length) {
	return (updateCrc(initialCrc, data, length) ^ initialCrc) >>> 0;
}
function checkCrc(buffer, crcLength, chunkName) {
	const expectedCrc = buffer.readUint32();
	const actualCrc = crc(new Uint8Array(buffer.buffer, buffer.byteOffset + buffer.offset - crcLength - 4, crcLength), crcLength);
	if (actualCrc !== expectedCrc) throw new Error(`CRC mismatch for chunk ${chunkName}. Expected ${expectedCrc}, found ${actualCrc}`);
}
function writeCrc(buffer, length) {
	buffer.writeUint32(crc(new Uint8Array(buffer.buffer, buffer.byteOffset + buffer.offset - length, length), length));
}
var crcTable, initialCrc;
var init_crc = __esmMin((() => {
	crcTable = [];
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) if (c & 1) c = 3988292384 ^ c >>> 1;
		else c = c >>> 1;
		crcTable[n] = c;
	}
	initialCrc = 4294967295;
}));
//#endregion
//#region node_modules/fast-png/lib-esm/helpers/unfilter.js
function unfilterNone(currentLine, newLine, bytesPerLine) {
	for (let i = 0; i < bytesPerLine; i++) newLine[i] = currentLine[i];
}
function unfilterSub(currentLine, newLine, bytesPerLine, bytesPerPixel) {
	let i = 0;
	for (; i < bytesPerPixel; i++) newLine[i] = currentLine[i];
	for (; i < bytesPerLine; i++) newLine[i] = currentLine[i] + newLine[i - bytesPerPixel] & 255;
}
function unfilterUp(currentLine, newLine, prevLine, bytesPerLine) {
	let i = 0;
	if (prevLine.length === 0) for (; i < bytesPerLine; i++) newLine[i] = currentLine[i];
	else for (; i < bytesPerLine; i++) newLine[i] = currentLine[i] + prevLine[i] & 255;
}
function unfilterAverage(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel) {
	let i = 0;
	if (prevLine.length === 0) {
		for (; i < bytesPerPixel; i++) newLine[i] = currentLine[i];
		for (; i < bytesPerLine; i++) newLine[i] = currentLine[i] + (newLine[i - bytesPerPixel] >> 1) & 255;
	} else {
		for (; i < bytesPerPixel; i++) newLine[i] = currentLine[i] + (prevLine[i] >> 1) & 255;
		for (; i < bytesPerLine; i++) newLine[i] = currentLine[i] + (newLine[i - bytesPerPixel] + prevLine[i] >> 1) & 255;
	}
}
function unfilterPaeth(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel) {
	let i = 0;
	if (prevLine.length === 0) {
		for (; i < bytesPerPixel; i++) newLine[i] = currentLine[i];
		for (; i < bytesPerLine; i++) newLine[i] = currentLine[i] + newLine[i - bytesPerPixel] & 255;
	} else {
		for (; i < bytesPerPixel; i++) newLine[i] = currentLine[i] + prevLine[i] & 255;
		for (; i < bytesPerLine; i++) newLine[i] = currentLine[i] + paethPredictor(newLine[i - bytesPerPixel], prevLine[i], prevLine[i - bytesPerPixel]) & 255;
	}
}
function paethPredictor(a, b, c) {
	const p = a + b - c;
	const pa = Math.abs(p - a);
	const pb = Math.abs(p - b);
	const pc = Math.abs(p - c);
	if (pa <= pb && pa <= pc) return a;
	else if (pb <= pc) return b;
	else return c;
}
var init_unfilter = __esmMin((() => {}));
//#endregion
//#region node_modules/fast-png/lib-esm/helpers/applyUnfilter.js
/**
* Apllies filter on scanline based on the filter type.
* @param filterType - The filter type to apply.
* @param currentLine - The current line of pixel data.
* @param newLine - The new line of pixel data.
* @param prevLine - The previous line of pixel data.
* @param passLineBytes - The number of bytes in the pass line.
* @param bytesPerPixel - The number of bytes per pixel.
*/
function applyUnfilter(filterType, currentLine, newLine, prevLine, passLineBytes, bytesPerPixel) {
	switch (filterType) {
		case 0:
			unfilterNone(currentLine, newLine, passLineBytes);
			break;
		case 1:
			unfilterSub(currentLine, newLine, passLineBytes, bytesPerPixel);
			break;
		case 2:
			unfilterUp(currentLine, newLine, prevLine, passLineBytes);
			break;
		case 3:
			unfilterAverage(currentLine, newLine, prevLine, passLineBytes, bytesPerPixel);
			break;
		case 4:
			unfilterPaeth(currentLine, newLine, prevLine, passLineBytes, bytesPerPixel);
			break;
		default: throw new Error(`Unsupported filter: ${filterType}`);
	}
}
var init_applyUnfilter = __esmMin((() => {
	init_unfilter();
}));
//#endregion
//#region node_modules/fast-png/lib-esm/helpers/decodeInterlaceAdam7.js
/**
* Decodes the Adam7 interlaced PNG data.
*
* @param params - DecodeInterlaceNullParams
* @returns - array of pixel data.
*/
function decodeInterlaceAdam7(params) {
	const { data, width, height, channels, depth } = params;
	const passes = [
		{
			x: 0,
			y: 0,
			xStep: 8,
			yStep: 8
		},
		{
			x: 4,
			y: 0,
			xStep: 8,
			yStep: 8
		},
		{
			x: 0,
			y: 4,
			xStep: 4,
			yStep: 8
		},
		{
			x: 2,
			y: 0,
			xStep: 4,
			yStep: 4
		},
		{
			x: 0,
			y: 2,
			xStep: 2,
			yStep: 4
		},
		{
			x: 1,
			y: 0,
			xStep: 2,
			yStep: 2
		},
		{
			x: 0,
			y: 1,
			xStep: 1,
			yStep: 2
		}
	];
	const bytesPerPixel = Math.ceil(depth / 8) * channels;
	const resultData = new Uint8Array(height * width * bytesPerPixel);
	let offset = 0;
	for (let passIndex = 0; passIndex < 7; passIndex++) {
		const pass = passes[passIndex];
		const passWidth = Math.ceil((width - pass.x) / pass.xStep);
		const passHeight = Math.ceil((height - pass.y) / pass.yStep);
		if (passWidth <= 0 || passHeight <= 0) continue;
		const passLineBytes = passWidth * bytesPerPixel;
		const prevLine = new Uint8Array(passLineBytes);
		for (let y = 0; y < passHeight; y++) {
			const filterType = data[offset++];
			const currentLine = data.subarray(offset, offset + passLineBytes);
			offset += passLineBytes;
			const newLine = new Uint8Array(passLineBytes);
			applyUnfilter(filterType, currentLine, newLine, prevLine, passLineBytes, bytesPerPixel);
			prevLine.set(newLine);
			for (let x = 0; x < passWidth; x++) {
				const outputX = pass.x + x * pass.xStep;
				const outputY = pass.y + y * pass.yStep;
				if (outputX >= width || outputY >= height) continue;
				for (let i = 0; i < bytesPerPixel; i++) resultData[(outputY * width + outputX) * bytesPerPixel + i] = newLine[x * bytesPerPixel + i];
			}
		}
	}
	if (depth === 16) {
		const uint16Data = new Uint16Array(resultData.buffer);
		if (osIsLittleEndian$1) for (let k = 0; k < uint16Data.length; k++) uint16Data[k] = swap16$1(uint16Data[k]);
		return uint16Data;
	} else return resultData;
}
function swap16$1(val) {
	return (val & 255) << 8 | val >> 8 & 255;
}
var uint16$1, osIsLittleEndian$1;
var init_decodeInterlaceAdam7 = __esmMin((() => {
	init_applyUnfilter();
	uint16$1 = new Uint16Array([255]);
	osIsLittleEndian$1 = new Uint8Array(uint16$1.buffer)[0] === 255;
}));
//#endregion
//#region node_modules/fast-png/lib-esm/helpers/decodeInterlaceNull.js
function decodeInterlaceNull(params) {
	const { data, width, height, channels, depth } = params;
	const bytesPerPixel = Math.ceil(depth / 8) * channels;
	const bytesPerLine = Math.ceil(depth / 8 * channels * width);
	const newData = new Uint8Array(height * bytesPerLine);
	let prevLine = empty;
	let offset = 0;
	let currentLine;
	let newLine;
	for (let i = 0; i < height; i++) {
		currentLine = data.subarray(offset + 1, offset + 1 + bytesPerLine);
		newLine = newData.subarray(i * bytesPerLine, (i + 1) * bytesPerLine);
		switch (data[offset]) {
			case 0:
				unfilterNone(currentLine, newLine, bytesPerLine);
				break;
			case 1:
				unfilterSub(currentLine, newLine, bytesPerLine, bytesPerPixel);
				break;
			case 2:
				unfilterUp(currentLine, newLine, prevLine, bytesPerLine);
				break;
			case 3:
				unfilterAverage(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel);
				break;
			case 4:
				unfilterPaeth(currentLine, newLine, prevLine, bytesPerLine, bytesPerPixel);
				break;
			default: throw new Error(`Unsupported filter: ${data[offset]}`);
		}
		prevLine = newLine;
		offset += bytesPerLine + 1;
	}
	if (depth === 16) {
		const uint16Data = new Uint16Array(newData.buffer);
		if (osIsLittleEndian) for (let k = 0; k < uint16Data.length; k++) uint16Data[k] = swap16(uint16Data[k]);
		return uint16Data;
	} else return newData;
}
function swap16(val) {
	return (val & 255) << 8 | val >> 8 & 255;
}
var uint16, osIsLittleEndian, empty;
var init_decodeInterlaceNull = __esmMin((() => {
	init_unfilter();
	uint16 = new Uint16Array([255]);
	osIsLittleEndian = new Uint8Array(uint16.buffer)[0] === 255;
	empty = /* @__PURE__ */ new Uint8Array(0);
}));
//#endregion
//#region node_modules/fast-png/lib-esm/helpers/signature.js
function writeSignature(buffer) {
	buffer.writeBytes(pngSignature);
}
function checkSignature(buffer) {
	if (!hasPngSignature(buffer.readBytes(pngSignature.length))) throw new Error("wrong PNG signature");
}
function hasPngSignature(array) {
	if (array.length < pngSignature.length) return false;
	for (let i = 0; i < pngSignature.length; i++) if (array[i] !== pngSignature[i]) return false;
	return true;
}
var pngSignature;
var init_signature = __esmMin((() => {
	pngSignature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
}));
//#endregion
//#region node_modules/fast-png/lib-esm/helpers/text.js
function validateKeyword(keyword) {
	validateLatin1(keyword);
	if (keyword.length === 0 || keyword.length > 79) throw new Error("keyword length must be between 1 and 79");
}
function validateLatin1(text) {
	if (!latin1Regex.test(text)) throw new Error("invalid latin1 text");
}
function decodetEXt(text, buffer, length) {
	const keyword = readKeyword(buffer);
	text[keyword] = readLatin1(buffer, length - keyword.length - 1);
}
function encodetEXt(buffer, keyword, text) {
	validateKeyword(keyword);
	validateLatin1(text);
	const length = keyword.length + 1 + text.length;
	buffer.writeUint32(length);
	buffer.writeChars(textChunkName);
	buffer.writeChars(keyword);
	buffer.writeByte(NULL);
	buffer.writeChars(text);
	writeCrc(buffer, length + 4);
}
function readKeyword(buffer) {
	buffer.mark();
	while (buffer.readByte() !== NULL);
	const end = buffer.offset;
	buffer.reset();
	const keyword = latin1Decoder.decode(buffer.readBytes(end - buffer.offset - 1));
	buffer.skip(1);
	validateKeyword(keyword);
	return keyword;
}
function readLatin1(buffer, length) {
	return latin1Decoder.decode(buffer.readBytes(length));
}
var textChunkName, NULL, latin1Decoder, latin1Regex;
var init_text = __esmMin((() => {
	init_crc();
	textChunkName = "tEXt";
	NULL = 0;
	latin1Decoder = new TextDecoder("latin1");
	latin1Regex = /^[\u0000-\u00FF]*$/;
}));
//#endregion
//#region node_modules/fast-png/lib-esm/internalTypes.js
var ColorType, CompressionMethod, FilterMethod, InterlaceMethod, DisposeOpType, BlendOpType;
var init_internalTypes = __esmMin((() => {
	ColorType = {
		UNKNOWN: -1,
		GREYSCALE: 0,
		TRUECOLOUR: 2,
		INDEXED_COLOUR: 3,
		GREYSCALE_ALPHA: 4,
		TRUECOLOUR_ALPHA: 6
	};
	CompressionMethod = {
		UNKNOWN: -1,
		DEFLATE: 0
	};
	FilterMethod = {
		UNKNOWN: -1,
		ADAPTIVE: 0
	};
	InterlaceMethod = {
		UNKNOWN: -1,
		NO_INTERLACE: 0,
		ADAM7: 1
	};
	DisposeOpType = {
		NONE: 0,
		BACKGROUND: 1,
		PREVIOUS: 2
	};
	BlendOpType = {
		SOURCE: 0,
		OVER: 1
	};
}));
//#endregion
//#region node_modules/fast-png/lib-esm/PngDecoder.js
function checkBitDepth(value) {
	if (value !== 1 && value !== 2 && value !== 4 && value !== 8 && value !== 16) throw new Error(`invalid bit depth: ${value}`);
	return value;
}
var PngDecoder;
var init_PngDecoder = __esmMin((() => {
	init_IOBuffer();
	init_pako();
	init_crc();
	init_decodeInterlaceAdam7();
	init_decodeInterlaceNull();
	init_signature();
	init_text();
	init_internalTypes();
	PngDecoder = class extends IOBuffer {
		_checkCrc;
		_inflator;
		_png;
		_apng;
		_end;
		_hasPalette;
		_palette;
		_hasTransparency;
		_transparency;
		_compressionMethod;
		_filterMethod;
		_interlaceMethod;
		_colorType;
		_isAnimated;
		_numberOfFrames;
		_numberOfPlays;
		_frames;
		_writingDataChunks;
		constructor(data, options = {}) {
			super(data);
			const { checkCrc = false } = options;
			this._checkCrc = checkCrc;
			this._inflator = new Inflate();
			this._png = {
				width: -1,
				height: -1,
				channels: -1,
				data: /* @__PURE__ */ new Uint8Array(0),
				depth: 1,
				text: {}
			};
			this._apng = {
				width: -1,
				height: -1,
				channels: -1,
				depth: 1,
				numberOfFrames: 1,
				numberOfPlays: 0,
				text: {},
				frames: []
			};
			this._end = false;
			this._hasPalette = false;
			this._palette = [];
			this._hasTransparency = false;
			this._transparency = /* @__PURE__ */ new Uint16Array(0);
			this._compressionMethod = CompressionMethod.UNKNOWN;
			this._filterMethod = FilterMethod.UNKNOWN;
			this._interlaceMethod = InterlaceMethod.UNKNOWN;
			this._colorType = ColorType.UNKNOWN;
			this._isAnimated = false;
			this._numberOfFrames = 1;
			this._numberOfPlays = 0;
			this._frames = [];
			this._writingDataChunks = false;
			this.setBigEndian();
		}
		decode() {
			checkSignature(this);
			while (!this._end) {
				const length = this.readUint32();
				const type = this.readChars(4);
				this.decodeChunk(length, type);
			}
			this.decodeImage();
			return this._png;
		}
		decodeApng() {
			checkSignature(this);
			while (!this._end) {
				const length = this.readUint32();
				const type = this.readChars(4);
				this.decodeApngChunk(length, type);
			}
			this.decodeApngImage();
			return this._apng;
		}
		decodeChunk(length, type) {
			const offset = this.offset;
			switch (type) {
				case "IHDR":
					this.decodeIHDR();
					break;
				case "PLTE":
					this.decodePLTE(length);
					break;
				case "IDAT":
					this.decodeIDAT(length);
					break;
				case "IEND":
					this._end = true;
					break;
				case "tRNS":
					this.decodetRNS(length);
					break;
				case "iCCP":
					this.decodeiCCP(length);
					break;
				case textChunkName:
					decodetEXt(this._png.text, this, length);
					break;
				case "pHYs":
					this.decodepHYs();
					break;
				default:
					this.skip(length);
					break;
			}
			if (this.offset - offset !== length) throw new Error(`Length mismatch while decoding chunk ${type}`);
			if (this._checkCrc) checkCrc(this, length + 4, type);
			else this.skip(4);
		}
		decodeApngChunk(length, type) {
			const offset = this.offset;
			if (type !== "fdAT" && type !== "IDAT" && this._writingDataChunks) this.pushDataToFrame();
			switch (type) {
				case "acTL":
					this.decodeACTL();
					break;
				case "fcTL":
					this.decodeFCTL();
					break;
				case "fdAT":
					this.decodeFDAT(length);
					break;
				default:
					this.decodeChunk(length, type);
					this.offset = offset + length;
					break;
			}
			if (this.offset - offset !== length) throw new Error(`Length mismatch while decoding chunk ${type}`);
			if (this._checkCrc) checkCrc(this, length + 4, type);
			else this.skip(4);
		}
		decodeIHDR() {
			const image = this._png;
			image.width = this.readUint32();
			image.height = this.readUint32();
			image.depth = checkBitDepth(this.readUint8());
			const colorType = this.readUint8();
			this._colorType = colorType;
			let channels;
			switch (colorType) {
				case ColorType.GREYSCALE:
					channels = 1;
					break;
				case ColorType.TRUECOLOUR:
					channels = 3;
					break;
				case ColorType.INDEXED_COLOUR:
					channels = 1;
					break;
				case ColorType.GREYSCALE_ALPHA:
					channels = 2;
					break;
				case ColorType.TRUECOLOUR_ALPHA:
					channels = 4;
					break;
				case ColorType.UNKNOWN:
				default: throw new Error(`Unknown color type: ${colorType}`);
			}
			this._png.channels = channels;
			this._compressionMethod = this.readUint8();
			if (this._compressionMethod !== CompressionMethod.DEFLATE) throw new Error(`Unsupported compression method: ${this._compressionMethod}`);
			this._filterMethod = this.readUint8();
			this._interlaceMethod = this.readUint8();
		}
		decodeACTL() {
			this._numberOfFrames = this.readUint32();
			this._numberOfPlays = this.readUint32();
			this._isAnimated = true;
		}
		decodeFCTL() {
			const image = {
				sequenceNumber: this.readUint32(),
				width: this.readUint32(),
				height: this.readUint32(),
				xOffset: this.readUint32(),
				yOffset: this.readUint32(),
				delayNumber: this.readUint16(),
				delayDenominator: this.readUint16(),
				disposeOp: this.readUint8(),
				blendOp: this.readUint8(),
				data: /* @__PURE__ */ new Uint8Array(0)
			};
			this._frames.push(image);
		}
		decodePLTE(length) {
			if (length % 3 !== 0) throw new RangeError(`PLTE field length must be a multiple of 3. Got ${length}`);
			const l = length / 3;
			this._hasPalette = true;
			const palette = [];
			this._palette = palette;
			for (let i = 0; i < l; i++) palette.push([
				this.readUint8(),
				this.readUint8(),
				this.readUint8()
			]);
		}
		decodeIDAT(length) {
			this._writingDataChunks = true;
			const dataLength = length;
			const dataOffset = this.offset + this.byteOffset;
			this._inflator.push(new Uint8Array(this.buffer, dataOffset, dataLength));
			if (this._inflator.err) throw new Error(`Error while decompressing the data: ${this._inflator.err}`);
			this.skip(length);
		}
		decodeFDAT(length) {
			this._writingDataChunks = true;
			let dataLength = length;
			let dataOffset = this.offset + this.byteOffset;
			dataOffset += 4;
			dataLength -= 4;
			this._inflator.push(new Uint8Array(this.buffer, dataOffset, dataLength));
			if (this._inflator.err) throw new Error(`Error while decompressing the data: ${this._inflator.err}`);
			this.skip(length);
		}
		decodetRNS(length) {
			switch (this._colorType) {
				case ColorType.GREYSCALE:
				case ColorType.TRUECOLOUR:
					if (length % 2 !== 0) throw new RangeError(`tRNS chunk length must be a multiple of 2. Got ${length}`);
					if (length / 2 > this._png.width * this._png.height) throw new Error(`tRNS chunk contains more alpha values than there are pixels (${length / 2} vs ${this._png.width * this._png.height})`);
					this._hasTransparency = true;
					this._transparency = new Uint16Array(length / 2);
					for (let i = 0; i < length / 2; i++) this._transparency[i] = this.readUint16();
					break;
				case ColorType.INDEXED_COLOUR: {
					if (length > this._palette.length) throw new Error(`tRNS chunk contains more alpha values than there are palette colors (${length} vs ${this._palette.length})`);
					let i = 0;
					for (; i < length; i++) {
						const alpha = this.readByte();
						this._palette[i].push(alpha);
					}
					for (; i < this._palette.length; i++) this._palette[i].push(255);
					break;
				}
				case ColorType.UNKNOWN:
				case ColorType.GREYSCALE_ALPHA:
				case ColorType.TRUECOLOUR_ALPHA:
				default: throw new Error(`tRNS chunk is not supported for color type ${this._colorType}`);
			}
		}
		decodeiCCP(length) {
			const name = readKeyword(this);
			const compressionMethod = this.readUint8();
			if (compressionMethod !== CompressionMethod.DEFLATE) throw new Error(`Unsupported iCCP compression method: ${compressionMethod}`);
			const compressedProfile = this.readBytes(length - name.length - 2);
			this._png.iccEmbeddedProfile = {
				name,
				profile: inflate(compressedProfile)
			};
		}
		decodepHYs() {
			const ppuX = this.readUint32();
			const ppuY = this.readUint32();
			const unitSpecifier = this.readByte();
			this._png.resolution = {
				x: ppuX,
				y: ppuY,
				unit: unitSpecifier
			};
		}
		decodeApngImage() {
			this._apng.width = this._png.width;
			this._apng.height = this._png.height;
			this._apng.channels = this._png.channels;
			this._apng.depth = this._png.depth;
			this._apng.numberOfFrames = this._numberOfFrames;
			this._apng.numberOfPlays = this._numberOfPlays;
			this._apng.text = this._png.text;
			this._apng.resolution = this._png.resolution;
			for (let i = 0; i < this._numberOfFrames; i++) {
				const newFrame = {
					sequenceNumber: this._frames[i].sequenceNumber,
					delayNumber: this._frames[i].delayNumber,
					delayDenominator: this._frames[i].delayDenominator,
					data: this._apng.depth === 8 ? new Uint8Array(this._apng.width * this._apng.height * this._apng.channels) : new Uint16Array(this._apng.width * this._apng.height * this._apng.channels)
				};
				const frame = this._frames.at(i);
				if (frame) {
					frame.data = decodeInterlaceNull({
						data: frame.data,
						width: frame.width,
						height: frame.height,
						channels: this._apng.channels,
						depth: this._apng.depth
					});
					if (this._hasPalette) this._apng.palette = this._palette;
					if (this._hasTransparency) this._apng.transparency = this._transparency;
					if (i === 0 || frame.xOffset === 0 && frame.yOffset === 0 && frame.width === this._png.width && frame.height === this._png.height) newFrame.data = frame.data;
					else {
						const prevFrame = this._apng.frames.at(i - 1);
						this.disposeFrame(frame, prevFrame, newFrame);
						this.addFrameDataToCanvas(newFrame, frame);
					}
					this._apng.frames.push(newFrame);
				}
			}
			return this._apng;
		}
		disposeFrame(frame, prevFrame, imageFrame) {
			switch (frame.disposeOp) {
				case DisposeOpType.NONE: break;
				case DisposeOpType.BACKGROUND:
					for (let row = 0; row < this._png.height; row++) for (let col = 0; col < this._png.width; col++) {
						const index = (row * frame.width + col) * this._png.channels;
						for (let channel = 0; channel < this._png.channels; channel++) imageFrame.data[index + channel] = 0;
					}
					break;
				case DisposeOpType.PREVIOUS:
					imageFrame.data.set(prevFrame.data);
					break;
				default: throw new Error("Unknown disposeOp");
			}
		}
		addFrameDataToCanvas(imageFrame, frame) {
			const maxValue = 1 << this._png.depth;
			const calculatePixelIndices = (row, col) => {
				return {
					index: ((row + frame.yOffset) * this._png.width + frame.xOffset + col) * this._png.channels,
					frameIndex: (row * frame.width + col) * this._png.channels
				};
			};
			switch (frame.blendOp) {
				case BlendOpType.SOURCE:
					for (let row = 0; row < frame.height; row++) for (let col = 0; col < frame.width; col++) {
						const { index, frameIndex } = calculatePixelIndices(row, col);
						for (let channel = 0; channel < this._png.channels; channel++) imageFrame.data[index + channel] = frame.data[frameIndex + channel];
					}
					break;
				case BlendOpType.OVER:
					for (let row = 0; row < frame.height; row++) for (let col = 0; col < frame.width; col++) {
						const { index, frameIndex } = calculatePixelIndices(row, col);
						for (let channel = 0; channel < this._png.channels; channel++) {
							const sourceAlpha = frame.data[frameIndex + this._png.channels - 1] / maxValue;
							const foregroundValue = channel % (this._png.channels - 1) === 0 ? 1 : frame.data[frameIndex + channel];
							const value = Math.floor(sourceAlpha * foregroundValue + (1 - sourceAlpha) * imageFrame.data[index + channel]);
							imageFrame.data[index + channel] += value;
						}
					}
					break;
				default: throw new Error("Unknown blendOp");
			}
		}
		decodeImage() {
			if (this._inflator.err) throw new Error(`Error while decompressing the data: ${this._inflator.err}`);
			const data = this._isAnimated ? (this._frames?.at(0)).data : this._inflator.result;
			if (this._filterMethod !== FilterMethod.ADAPTIVE) throw new Error(`Filter method ${this._filterMethod} not supported`);
			if (this._interlaceMethod === InterlaceMethod.NO_INTERLACE) this._png.data = decodeInterlaceNull({
				data,
				width: this._png.width,
				height: this._png.height,
				channels: this._png.channels,
				depth: this._png.depth
			});
			else if (this._interlaceMethod === InterlaceMethod.ADAM7) this._png.data = decodeInterlaceAdam7({
				data,
				width: this._png.width,
				height: this._png.height,
				channels: this._png.channels,
				depth: this._png.depth
			});
			else throw new Error(`Interlace method ${this._interlaceMethod} not supported`);
			if (this._hasPalette) this._png.palette = this._palette;
			if (this._hasTransparency) this._png.transparency = this._transparency;
		}
		pushDataToFrame() {
			const result = this._inflator.result;
			const lastFrame = this._frames.at(-1);
			if (lastFrame) lastFrame.data = result;
			else this._frames.push({
				sequenceNumber: 0,
				width: this._png.width,
				height: this._png.height,
				xOffset: 0,
				yOffset: 0,
				delayNumber: 0,
				delayDenominator: 0,
				disposeOp: DisposeOpType.NONE,
				blendOp: BlendOpType.SOURCE,
				data: result
			});
			this._inflator = new Inflate();
			this._writingDataChunks = false;
		}
	};
}));
//#endregion
//#region node_modules/fast-png/lib-esm/PngEncoder.js
function checkInteger(value, name) {
	if (Number.isInteger(value) && value > 0) return value;
	throw new TypeError(`${name} must be a positive integer`);
}
function getColorType(data, palette) {
	const { channels = 4, depth = 8 } = data;
	if (channels !== 4 && channels !== 3 && channels !== 2 && channels !== 1) throw new RangeError(`unsupported number of channels: ${channels}`);
	const returnValue = {
		channels,
		depth,
		colorType: ColorType.UNKNOWN
	};
	switch (channels) {
		case 4:
			returnValue.colorType = ColorType.TRUECOLOUR_ALPHA;
			break;
		case 3:
			returnValue.colorType = ColorType.TRUECOLOUR;
			break;
		case 1:
			if (palette) returnValue.colorType = ColorType.INDEXED_COLOUR;
			else returnValue.colorType = ColorType.GREYSCALE;
			break;
		case 2:
			returnValue.colorType = ColorType.GREYSCALE_ALPHA;
			break;
		default: throw new Error("unsupported number of channels");
	}
	return returnValue;
}
function writeDataBytes(data, newData, slotsPerLine, offset) {
	for (let j = 0; j < slotsPerLine; j++) newData.writeByte(data[offset++]);
	return offset;
}
function writeDataInterlaced(imageData, data, newData, offset) {
	const passes = [
		{
			x: 0,
			y: 0,
			xStep: 8,
			yStep: 8
		},
		{
			x: 4,
			y: 0,
			xStep: 8,
			yStep: 8
		},
		{
			x: 0,
			y: 4,
			xStep: 4,
			yStep: 8
		},
		{
			x: 2,
			y: 0,
			xStep: 4,
			yStep: 4
		},
		{
			x: 0,
			y: 2,
			xStep: 2,
			yStep: 4
		},
		{
			x: 1,
			y: 0,
			xStep: 2,
			yStep: 2
		},
		{
			x: 0,
			y: 1,
			xStep: 1,
			yStep: 2
		}
	];
	const { width, height, channels, depth } = imageData;
	let pixelSize = 0;
	if (depth === 16) pixelSize = channels * depth / 8 / 2;
	else pixelSize = channels * depth / 8;
	for (let passIndex = 0; passIndex < 7; passIndex++) {
		const pass = passes[passIndex];
		const passWidth = Math.floor((width - pass.x + pass.xStep - 1) / pass.xStep);
		const passHeight = Math.floor((height - pass.y + pass.yStep - 1) / pass.yStep);
		if (passWidth <= 0 || passHeight <= 0) continue;
		const passLineBytes = passWidth * pixelSize;
		for (let y = 0; y < passHeight; y++) {
			const imageY = pass.y + y * pass.yStep;
			const rawScanline = depth <= 8 ? new Uint8Array(passLineBytes) : new Uint16Array(passLineBytes);
			let rawOffset = 0;
			for (let x = 0; x < passWidth; x++) {
				const imageX = pass.x + x * pass.xStep;
				if (imageX < width && imageY < height) {
					const srcPos = (imageY * width + imageX) * pixelSize;
					for (let i = 0; i < pixelSize; i++) rawScanline[rawOffset++] = data[srcPos + i];
				}
			}
			newData.writeByte(0);
			if (depth === 8) newData.writeBytes(rawScanline);
			else if (depth === 16) for (const value of rawScanline) {
				newData.writeByte(value >> 8 & 255);
				newData.writeByte(value & 255);
			}
		}
	}
	return offset;
}
function writeDataUint16(data, newData, slotsPerLine, offset) {
	for (let j = 0; j < slotsPerLine; j++) newData.writeUint16(data[offset++]);
	return offset;
}
var defaultZlibOptions, PngEncoder;
var init_PngEncoder = __esmMin((() => {
	init_IOBuffer();
	init_pako();
	init_crc();
	init_signature();
	init_text();
	init_internalTypes();
	defaultZlibOptions = { level: 3 };
	PngEncoder = class extends IOBuffer {
		_png;
		_zlibOptions;
		_colorType;
		_interlaceMethod;
		constructor(data, options = {}) {
			super();
			this._colorType = ColorType.UNKNOWN;
			this._zlibOptions = {
				...defaultZlibOptions,
				...options.zlib
			};
			this._png = this._checkData(data);
			this._interlaceMethod = (options.interlace === "Adam7" ? InterlaceMethod.ADAM7 : InterlaceMethod.NO_INTERLACE) ?? InterlaceMethod.NO_INTERLACE;
			this.setBigEndian();
		}
		encode() {
			writeSignature(this);
			this.encodeIHDR();
			if (this._png.palette) {
				this.encodePLTE();
				if (this._png.palette[0].length === 4) this.encodeTRNS();
			}
			this.encodeData();
			if (this._png.text) for (const [keyword, text] of Object.entries(this._png.text)) encodetEXt(this, keyword, text);
			this.encodeIEND();
			return this.toArray();
		}
		encodeIHDR() {
			this.writeUint32(13);
			this.writeChars("IHDR");
			this.writeUint32(this._png.width);
			this.writeUint32(this._png.height);
			this.writeByte(this._png.depth);
			this.writeByte(this._colorType);
			this.writeByte(CompressionMethod.DEFLATE);
			this.writeByte(FilterMethod.ADAPTIVE);
			this.writeByte(this._interlaceMethod);
			writeCrc(this, 17);
		}
		encodeIEND() {
			this.writeUint32(0);
			this.writeChars("IEND");
			writeCrc(this, 4);
		}
		encodePLTE() {
			const paletteLength = this._png.palette?.length * 3;
			this.writeUint32(paletteLength);
			this.writeChars("PLTE");
			for (const color of this._png.palette) {
				this.writeByte(color[0]);
				this.writeByte(color[1]);
				this.writeByte(color[2]);
			}
			writeCrc(this, 4 + paletteLength);
		}
		encodeTRNS() {
			const alpha = this._png.palette.filter((color) => {
				return color.at(-1) !== 255;
			});
			this.writeUint32(alpha.length);
			this.writeChars("tRNS");
			for (const el of alpha) this.writeByte(el.at(-1));
			writeCrc(this, 4 + alpha.length);
		}
		encodeIDAT(data) {
			this.writeUint32(data.length);
			this.writeChars("IDAT");
			this.writeBytes(data);
			writeCrc(this, data.length + 4);
		}
		encodeData() {
			const { width, height, channels, depth, data } = this._png;
			const slotsPerLine = depth <= 8 ? Math.ceil(width * depth / 8) * channels : Math.ceil(width * depth / 8 * channels / 2);
			const newData = new IOBuffer().setBigEndian();
			let offset = 0;
			if (this._interlaceMethod === InterlaceMethod.NO_INTERLACE) for (let i = 0; i < height; i++) {
				newData.writeByte(0);
				if (depth === 16) offset = writeDataUint16(data, newData, slotsPerLine, offset);
				else offset = writeDataBytes(data, newData, slotsPerLine, offset);
			}
			else if (this._interlaceMethod === InterlaceMethod.ADAM7) offset = writeDataInterlaced(this._png, data, newData, offset);
			const compressed = deflate(newData.toArray(), this._zlibOptions);
			this.encodeIDAT(compressed);
		}
		_checkData(data) {
			const { colorType, channels, depth } = getColorType(data, data.palette);
			const png = {
				width: checkInteger(data.width, "width"),
				height: checkInteger(data.height, "height"),
				channels,
				data: data.data,
				depth,
				text: data.text,
				palette: data.palette
			};
			this._colorType = colorType;
			const expectedSize = depth < 8 ? Math.ceil(png.width * depth / 8) * png.height * channels : png.width * png.height * channels;
			if (png.data.length !== expectedSize) throw new RangeError(`wrong data size. Found ${png.data.length}, expected ${expectedSize}`);
			return png;
		}
	};
}));
//#endregion
//#region node_modules/fast-png/lib-esm/types.js
var ResolutionUnitSpecifier;
var init_types = __esmMin((() => {
	(function(ResolutionUnitSpecifier) {
		/**
		* Unit is unknown
		*/
		ResolutionUnitSpecifier[ResolutionUnitSpecifier["UNKNOWN"] = 0] = "UNKNOWN";
		/**
		* Unit is the metre
		*/
		ResolutionUnitSpecifier[ResolutionUnitSpecifier["METRE"] = 1] = "METRE";
	})(ResolutionUnitSpecifier || (ResolutionUnitSpecifier = {}));
}));
//#endregion
//#region node_modules/fast-png/lib-esm/convertIndexedToRgb.js
/**
* Converts indexed data into RGB/RGBA format
* @param decodedImage - Image to decode data from.
* @returns Uint8Array with RGB data.
*/
function convertIndexedToRgb(decodedImage) {
	const palette = decodedImage.palette;
	const depth = decodedImage.depth;
	if (!palette) throw new Error("Color palette is undefined.");
	checkDataSize(decodedImage);
	const indexSize = decodedImage.width * decodedImage.height;
	const resSize = indexSize * palette[0].length;
	const res = new Uint8Array(resSize);
	let indexPos = 0;
	let offset = 0;
	const indexes = new Uint8Array(indexSize);
	let bit = 255;
	switch (depth) {
		case 1:
			bit = 128;
			break;
		case 2:
			bit = 192;
			break;
		case 4:
			bit = 240;
			break;
		case 8:
			bit = 255;
			break;
		default: throw new Error("Incorrect depth value");
	}
	for (const byte of decodedImage.data) {
		let bit2 = bit;
		let shift = 8;
		while (bit2) {
			shift -= depth;
			indexes[indexPos++] = (byte & bit2) >> shift;
			bit2 = bit2 >> depth;
			if (indexPos % decodedImage.width === 0) break;
		}
	}
	if (decodedImage.palette) for (const index of indexes) {
		const color = decodedImage.palette.at(index);
		if (!color) throw new Error("Incorrect index of palette color");
		res.set(color, offset);
		offset += color.length;
	}
	return res;
}
function checkDataSize(image) {
	const expectedSize = image.depth < 8 ? Math.ceil(image.width * image.depth / 8) * image.height * image.channels : image.width * image.height * image.channels;
	if (image.data.length !== expectedSize) throw new RangeError(`wrong data size. Found ${image.data.length}, expected ${expectedSize}`);
}
var init_convertIndexedToRgb = __esmMin((() => {}));
//#endregion
//#region node_modules/fast-png/lib-esm/index.js
var lib_esm_exports = /* @__PURE__ */ __exportAll({
	ResolutionUnitSpecifier: () => ResolutionUnitSpecifier,
	convertIndexedToRgb: () => convertIndexedToRgb,
	decode: () => decodePng,
	decodeApng: () => decodeApng,
	encode: () => encodePng,
	hasPngSignature: () => hasPngSignature
});
function decodePng(data, options) {
	return new PngDecoder(data, options).decode();
}
function encodePng(png, options) {
	return new PngEncoder(png, options).encode();
}
function decodeApng(data, options) {
	return new PngDecoder(data, options).decodeApng();
}
var init_lib_esm = __esmMin((() => {
	init_PngDecoder();
	init_PngEncoder();
	init_signature();
	init_types();
	init_convertIndexedToRgb();
}));
//#endregion
export { lib_esm_exports as n, init_lib_esm as t };
