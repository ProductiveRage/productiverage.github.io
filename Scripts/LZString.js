// From https://raw.github.com/pieroxy/lz-string/master/libs/lz-string-1.3.0.js
var LZString = (function() {

	function decompressFromUTF16(input) {
		var output = "",
			current,
			c,
			status = 0,
			i = 0;
		
		while (i < input.length) {
			c = input.charCodeAt(i) - 32;
			
			switch (status++) {
				case 0:
					current = c << 1;
					break;
				case 1:
					output += String.fromCharCode(current | (c >> 14));
					current = (c&16383) << 2;
					break;
				case 2:
					output += String.fromCharCode(current | (c >> 13));
					current = (c&8191) << 3;
					break;
				case 3:
					output += String.fromCharCode(current | (c >> 12));
					current = (c&4095) << 4;
					break;
				case 4:
					output += String.fromCharCode(current | (c >> 11));
					current = (c&2047) << 5;
					break;
				case 5:
					output += String.fromCharCode(current | (c >> 10));
					current = (c&1023) << 6;
					break;
				case 6:
					output += String.fromCharCode(current | (c >> 9));
					current = (c&511) << 7;
					break;
				case 7:
					output += String.fromCharCode(current | (c >> 8));
					current = (c&255) << 8;
					break;
				case 8:
					output += String.fromCharCode(current | (c >> 7));
					current = (c&127) << 9;
					break;
				case 9:
					output += String.fromCharCode(current | (c >> 6));
					current = (c&63) << 10;
					break;
				case 10:
					output += String.fromCharCode(current | (c >> 5));
					current = (c&31) << 11;
					break;
				case 11:
					output += String.fromCharCode(current | (c >> 4));
					current = (c&15) << 12;
					break;
				case 12:
					output += String.fromCharCode(current | (c >> 3));
					current = (c&7) << 13;
					break;
				case 13:
					output += String.fromCharCode(current | (c >> 2));
					current = (c&3) << 14;
					break;
				case 14:
					output += String.fromCharCode(current | (c >> 1));
					current = (c&1) << 15;
					break;
				case 15:
					output += String.fromCharCode(current | c);
					status=0;
					break;
			}

			i++;
		}
		
		return decompress(output);
	}

	function decompress(compressed) {
		var dictionary = [],
			next,
			enlargeIn = 4,
			dictSize = 4,
			numBits = 3,
			entry = "",
			result = "",
			i,
			w,
			bits, resb, maxpower, power,
			c,
			errorCount = 0,
			literal,
			data = {string:compressed, val:compressed.charCodeAt(0), position:32768, index:1};
		
		for (i = 0; i < 3; i += 1) {
			dictionary[i] = i;
		}
		
		bits = 0;
		maxpower = Math.pow(2,2);
		power=1;
		while (power!=maxpower) {
			resb = data.val & data.position;
			data.position >>= 1;
			if (data.position == 0) {
				data.position = 32768;
				data.val = data.string.charCodeAt(data.index++);
			}
			bits |= (resb>0 ? 1 : 0) * power;
			power <<= 1;
		}
		
		switch (next = bits) {
			case 0: 
					bits = 0;
					maxpower = Math.pow(2,8);
					power=1;
					while (power!=maxpower) {
						resb = data.val & data.position;
						data.position >>= 1;
						if (data.position == 0) {
							data.position = 32768;
							data.val = data.string.charCodeAt(data.index++);
						}
						bits |= (resb>0 ? 1 : 0) * power;
						power <<= 1;
					}
				c = String.fromCharCode(bits);
				break;
			case 1: 
					bits = 0;
					maxpower = Math.pow(2,16);
					power=1;
					while (power!=maxpower) {
						resb = data.val & data.position;
						data.position >>= 1;
						if (data.position == 0) {
							data.position = 32768;
							data.val = data.string.charCodeAt(data.index++);
						}
						bits |= (resb>0 ? 1 : 0) * power;
						power <<= 1;
					}
				c = String.fromCharCode(bits);
				break;
			case 2: 
				return "";
		}
		dictionary[3] = c;
		w = result = c;
		while (true) {
			bits = 0;
			maxpower = Math.pow(2,numBits);
			power=1;
			while (power!=maxpower) {
				resb = data.val & data.position;
				data.position >>= 1;
				if (data.position == 0) {
					data.position = 32768;
					data.val = data.string.charCodeAt(data.index++);
				}
				bits |= (resb>0 ? 1 : 0) * power;
				power <<= 1;
			}

			switch (c = bits) {
				case 0: 
					if (errorCount++ > 10000) {
						throw new Error("Invalid input");
					}
					bits = 0;
					maxpower = Math.pow(2,8);
					power=1;
					while (power!=maxpower) {
						resb = data.val & data.position;
						data.position >>= 1;
						if (data.position == 0) {
							data.position = 32768;
							data.val = data.string.charCodeAt(data.index++);
						}
						bits |= (resb>0 ? 1 : 0) * power;
						power <<= 1;
					}

					dictionary[dictSize++] = String.fromCharCode(bits);
					c = dictSize-1;
					enlargeIn--;
					break;
				case 1: 
					bits = 0;
					maxpower = Math.pow(2,16);
					power=1;
					while (power!=maxpower) {
						resb = data.val & data.position;
						data.position >>= 1;
						if (data.position == 0) {
							data.position = 32768;
							data.val = data.string.charCodeAt(data.index++);
						}
						bits |= (resb>0 ? 1 : 0) * power;
						power <<= 1;
					}
					dictionary[dictSize++] = String.fromCharCode(bits);
					c = dictSize-1;
					enlargeIn--;
					break;
				case 2: 
					return result;
			}
			
			if (enlargeIn == 0) {
				enlargeIn = Math.pow(2, numBits);
				numBits++;
			}
			
			if (dictionary[c]) {
				entry = dictionary[c];
			} else {
				if (c === dictSize) {
					entry = w + w.charAt(0);
				} else {
					throw new Error("Invalid input");
				}
			}
			result += entry;
			
			// Add w+entry[0] to the dictionary.
			dictionary[dictSize++] = w + entry.charAt(0);
			enlargeIn--;
			
			w = entry;
			
			if (enlargeIn == 0) {
				enlargeIn = Math.pow(2, numBits);
				numBits++;
			}
			
		}
	}

	return {
		DecompressFromUTF16: decompressFromUTF16
	};

})();