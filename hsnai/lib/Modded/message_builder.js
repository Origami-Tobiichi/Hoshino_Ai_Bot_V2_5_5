/**
 * Do not remove this watermark.
 *
 * NIXCODE - Advanced WhatsApp Interactive Message Builder
 * Built for creating buttons, carousels, native flows,
 * and AI rich response payloads using Baileys with
 * fluent chaining, flexible payload customization,
 * and scalable architecture for modern bot development.
 *
 * Runtime:
 * - Baileys: @whiskeysockets/baileys (latest)
 *
 * Created by Nixel
 * Contributors: ~ Ahmad tumbuh kembang
 *
 * WhatsApp: wa.me/6285188349341
 * Channel: https://whatsapp.com/channel/0029VbCV1ck8fewpdNb2TY2k
 *
 * Copyright (c) 2026 Nixel
 *
 * Permission is granted to use and modify this library
 * for personal or commercial projects.
 *
 * Reuploading, reselling, relicensing, or redistributing
 * this library as a standalone product is prohibited.
 *
 * Do not claim this project as your own original work.
 *
 * ---
 * This file is a CommonJS port (module structure only — no functional
 * changes to the upstream V4.7 logic) of the original NIXCODE ESM source,
 * adapted for hsnai's CJS plugin architecture. Unlike the earlier V4.6
 * port (AIRich/Toolkit/BaseBuilder/ORich only), this is the FULL library:
 * Button, ButtonV2, Carousel, AIRich, Toolkit, BaseBuilder, and the ORich
 * alias. Kept from the earlier hsnai port: the BaseBuilder convenience
 * shortcuts (text/footer/title/subtitle/image) and reuse of hsnai's own
 * `tokenizeCodeV2` instead of duplicating the upstream tokenizer.
 *
 * Notable behavior change vs the old V4.6 hsnai port: `addSource()` now
 * embeds sources directly into a section/node (upstream V4.7 design)
 * instead of writing to a separate `richResponseSourcesMetadata` field —
 * that field has been removed since V4.7 no longer populates it.
 *
 * Kept as-is from the old hsnai port: `forwardedAiBotMessageInfo.botJid`
 * stays `'0@bot'` (not upstream's `'867051314767696@bot'`).
 */

'use strict';

const VERSION = '4.7';

const { generateWAMessageFromContent, prepareWAMessageMedia, generateMessageIDV2 } = require('../Utils');
const crypto = require('crypto');
const { PassThrough, Readable } = require('stream');
const { tokenizeCodeV2 } = require('../Utils/rich-messages');

let sharp, ffmpeg;
try {
	sharp = require('sharp');
} catch {
	console.warn('⚠️ [hsnai] WARNING: Module "sharp" is not installed. Image resizing & processing may not work.\n👉 Please run: npm install sharp');
}

try {
	ffmpeg = require('fluent-ffmpeg');
} catch {
	console.warn('⚠️ [hsnai] WARNING: Module "fluent-ffmpeg" is not installed. Video previews may not work.\n👉 Please run: npm install fluent-ffmpeg');
}

function extractIE(text, { extract = true, hyperlink = true, citation = true, latex = true } = {}) {
	if (!extract) {
		return {
			text,
			ie: [],
			inline_entities: [],
		};
	}

	const createIE = (type, ie) => {
		if (type == 'hyperlink') {
			return {
				key: ie.key,
				metadata: {
					display_name: ie.text,
					is_trusted: ie.is_trusted,
					url: ie.url,
					__typename: 'GenAIInlineLinkItem',
				},
			};
		}

		if (type == 'citation') {
			return {
				key: ie.key,
				metadata: {
					reference_id: ie.reference_id,
					reference_url: ie.url,
					reference_title: ie.url,
					reference_display_name: ie.url,
					sources: [],
					__typename: 'GenAISearchCitationItem',
				},
			};
		}

		if (type == 'latex') {
			return {
				key: ie.key,
				metadata: {
					latex_expression: ie.text,
					latex_image: {
						url: ie.url,
						width: Number(ie.width) || 100,
						height: Number(ie.height) || 100,
					},
					font_height: Number(ie.font_height) || 83.333333333333,
					padding: Number(ie.padding) || 15,
					__typename: 'GenAILatexItem',
				},
			};
		}
	};

	let ie = [];
	let inline_entities = [];
	let result = '';
	let last = 0;
	let citation_index = 1;
	let hyperlink_index = 0;
	let latex_index = 0;
	let stack = [];

	for (let i = 0; i < text.length; i++) {
		if (text[i] == '[' && text[i - 1] != '\\') {
			stack.push(i);
		} else if (text[i] == ']' && (text[i + 1] == '(' || text[i + 1] == '<')) {
			let start = stack.pop();

			if (start == null) continue;

			let open = text[i + 1];
			let close = open == '(' ? ')' : '>';
			let type = open == '(' ? 'link' : 'latex';
			let end = i + 2;
			let depth = 1;

			while (end < text.length && depth) {
				if (text[end] == open && text[end - 1] != '\\') depth++;
				else if (text[end] == close && text[end - 1] != '\\') depth--;
				end++;
			}

			if (depth) continue;

			let raw = text.slice(start + 1, i).trim();
			let url = text.slice(i + 2, end - 1).trim();

			let key;
			let tag;
			let data;

			if (type == 'latex') {
				if (!latex) continue;

				let [txt = '', width = null, height = null, font_height = null, padding = null] = raw.split('|');

				key = `NIXEL_LATEX_${latex_index++}`;
				tag = `{{${key}}}${txt || 'image'}{{/${key}}}`;

				data = {
					type: 'latex',
					ie: {
						key,
						text: txt,
						url,
						width,
						height,
						font_height,
						padding,
					},
				};
			} else if (raw) {
				if (!hyperlink) continue;

				const trusted = !url.startsWith('!');

				if (!trusted) {
					url = url.slice(1);
				}

				key = `NIXEL_HYPERLINK_${hyperlink_index++}`;
				tag = `{{${key}}}${url}{{/${key}}}`;

				data = {
					type: 'hyperlink',
					ie: {
						key,
						text: raw,
						url,
						is_trusted: trusted,
					},
				};
			} else {
				if (!citation) continue;

				key = `NIXEL_CITATION_${citation_index - 1}`;
				tag = `{{${key}}}${url}{{/${key}}}`;

				data = {
					type: 'citation',
					ie: {
						reference_id: citation_index++,
						key,
						text: '',
						url,
					},
				};
			}

			result += text.slice(last, start) + tag;
			last = end;

			ie.push(data);

			const entity = createIE(data.type, data.ie);

			if (entity) {
				inline_entities.push(entity);
			}

			i = end - 1;
		}
	}

	result += text.slice(last);

	return {
		text: result,
		ie,
		inline_entities,
	};
}

async function waitAllPromises(input) {
	const isPromise = (v) => v && typeof v.then === 'function';
	const isObject = (v) => v && typeof v === 'object';

	const deep = async (v) => {
		if (isPromise(v)) return deep(await v);
		if (Array.isArray(v)) return Promise.all(v.map(deep));
		if (isObject(v)) {
			const entries = await Promise.all(Object.entries(v).map(async ([k, val]) => [k, await deep(val)]));
			return Object.fromEntries(entries);
		}
		return v;
	};

	return deep(await input);
}

class AIRichError extends Error {
	constructor(message, code, meta = {}) {
		super(message);
		this.name = 'AIRichError';
		this.code = code;
		Object.assign(this, meta);
	}
}

class ItemNotFoundError extends AIRichError {
	constructor(id, availableIds = []) {
		super(`Item id "${id}" not found${availableIds.length ? ` (available: ${availableIds.join(', ')})` : ' (no items have an id yet)'}`, 'ITEM_NOT_FOUND', { id, availableIds });
		this.name = 'ItemNotFoundError';
	}
}

class DuplicateIdError extends AIRichError {
	constructor(id) {
		super(`Item id "${id}" already exists`, 'DUPLICATE_ID', { id });
		this.name = 'DuplicateIdError';
	}
}

class InvalidTargetError extends AIRichError {
	constructor(message, meta = {}) {
		super(message, 'INVALID_TARGET', meta);
		this.name = 'InvalidTargetError';
	}
}

class ContentValidationError extends AIRichError {
	constructor(message, meta = {}) {
		super(message, 'CONTENT_VALIDATION', meta);
		this.name = 'ContentValidationError';
	}
}

class Toolkit {
	constructor() {}

	static extractIE(text, { extract = true, hyperlink = true, citation = true, latex = true } = {}) {
		return extractIE(text, { extract, hyperlink, citation, latex });
	}

	static async resize(buffer, x, y, fit = 'cover') {
		return await sharp(buffer)
			.resize(x, y, {
				fit,
				position: 'center',
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			})
			.png()
			.toBuffer();
	}

	static async waitAllPromises(input) {
		return await waitAllPromises(input);
	}

	static async fetchBuffer(url, options = {}, { silent = true } = {}) {
		try {
			let response = await fetch(url, options);
			if (!response.ok) throw Error(`HTTP ${response.status}`);
			return Buffer.from(await response.arrayBuffer());
		} catch (error) {
			if (silent) return Buffer.alloc(0);
			throw error;
		}
	}

	static async toUrl(_client, path, mediaType = 'document') {
		if (!path) throw new Error('Url or buffer needed');

		const media = await prepareWAMessageMedia(
			{
				[mediaType]: Buffer.isBuffer(path) ? path : { url: path },
			},
			{
				upload: _client.waUploadToServer,
				jid: '@newsletter',
			}
		);

		return Object.values(media)[0]?.url;
	}

	static async resolveMedia(_client, media, mediaType = 'image', { resolveUrl = false, resolveWAUrl = false, result = 'url', resize = false, width = 300, height = 300 } = {}) {
		const isUrl = (str) => /^https?:\/\/.+/i.test(str);

		const isWAUrl = (str) => /^https?:\/\/[^/]*\.whatsapp\.net\//i.test(str);

		if (Array.isArray(media)) {
			return Promise.all(
				media.map((item) =>
					Toolkit.resolveMedia(_client, item, mediaType, {
						resolveUrl,
						resolveWAUrl,
						result,
						resize,
						width,
						height,
					})
				)
			);
		}

		const originalIsBuffer = Buffer.isBuffer(media);

		if (typeof media === 'string' && isUrl(media)) {
			if (isWAUrl(media)) {
				if (resolveWAUrl) {
					media = await Toolkit.fetchBuffer(media, {}, { silent: true });
				} else if (!resolveUrl) {
					if (result === 'url') return media;

					media = await Toolkit.fetchBuffer(media, {}, { silent: true });
				}
			} else {
				if (!resolveUrl) {
					if (result === 'url') return media;

					media = await Toolkit.fetchBuffer(media, {}, { silent: true });
				} else {
					media = await Toolkit.fetchBuffer(media, {}, { silent: true });
				}
			}
		}

		if (typeof media === 'string' && !isUrl(media)) {
			media = Buffer.from(media, 'base64');
		}

		if (!Buffer.isBuffer(media) || !media.length) {
			return;
		}

		if (resize && Buffer.isBuffer(media)) {
			media = await Toolkit.resize(media, width, height);
		}

		if (result === 'buffer') {
			return media;
		}

		if (result === 'base64') {
			return media.toString('base64');
		}

		if (originalIsBuffer) {
			return Toolkit.toUrl(_client, media, mediaType);
		}

		return Toolkit.toUrl(_client, media, mediaType);
	}

	static getMp4Duration(buffer, { silent = true } = {}) {
		try {
			if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
				if (silent) return 0;
				throw new Error('Invalid buffer');
			}

			let offset = 0;

			while (offset < buffer.length - 8) {
				const size = buffer.readUInt32BE(offset);

				if (size < 8 || offset + size > buffer.length) {
					if (silent) return 0;
					throw new Error('Invalid atom size');
				}

				const type = buffer.toString('ascii', offset + 4, offset + 8);

				if (type === 'moov') {
					let moovOffset = offset + 8;
					const moovEnd = offset + size;

					while (moovOffset < moovEnd - 8) {
						const childSize = buffer.readUInt32BE(moovOffset);

						if (childSize < 8 || moovOffset + childSize > moovEnd) {
							if (silent) return 0;
							throw new Error('Invalid child atom size');
						}

						const childType = buffer.toString('ascii', moovOffset + 4, moovOffset + 8);

						if (childType === 'mvhd') {
							const version = buffer.readUInt8(moovOffset + 8);

							if (version === 0) {
								const timescale = buffer.readUInt32BE(moovOffset + 20);
								const duration = buffer.readUInt32BE(moovOffset + 24);

								if (!timescale) {
									if (silent) return 0;
									throw new Error('Invalid timescale');
								}

								return duration / timescale;
							}

							if (version === 1) {
								const timescale = buffer.readUInt32BE(moovOffset + 32);
								const duration = Number(buffer.readBigUInt64BE(moovOffset + 36));

								if (!timescale) {
									if (silent) return 0;
									throw new Error('Invalid timescale');
								}

								return duration / timescale;
							}
						}

						moovOffset += childSize;
					}
				}

				offset += size;
			}

			if (silent) return 0;

			throw new Error('No mvhd found!');
		} catch (err) {
			if (silent) return 0;
			throw err;
		}
	}

	static getMp4Preview(videoBuffer, { time, result = 'buffer', resize = true, width = 300, height = 300, silent = true } = {}) {
		return new Promise((resolve, reject) => {
			const fail = (err) => {
				if (silent) {
					return resolve(result === 'base64' ? '' : Buffer.alloc(0));
				}
				return reject(err);
			};

			try {
				if (!Buffer.isBuffer(videoBuffer) || !videoBuffer.length) {
					return fail(new Error('videoBuffer tidak valid atau kosong'));
				}

				const inputStream = new Readable({ read() {} });
				inputStream.push(videoBuffer);
				inputStream.push(null);

				const outputStream = new PassThrough();
				const chunks = [];

				outputStream.on('data', (chunk) => chunks.push(chunk));

				outputStream.on('end', async () => {
					try {
						let output = Buffer.concat(chunks);

						if (!output.length) {
							return fail(new Error('Output kosong — cek format atau timestamp video'));
						}

						if (resize) {
							output = await Toolkit.resize(output, width, height);
						}

						return resolve(result === 'base64' ? output.toString('base64') : output);
					} catch (err) {
						return fail(err);
					}
				});

				outputStream.on('error', fail);

				time = time ?? Math.min(Toolkit.getMp4Duration(videoBuffer) * 0.2, 10);

				ffmpeg(inputStream)
					.outputOptions([`-ss ${time}`, '-vframes 1', '-vcodec png', '-f image2pipe'])
					.on('error', (err) => fail(new Error(`ffmpeg error: ${err.message}`)))
					.pipe(outputStream, { end: true });
			} catch (err) {
				return fail(err);
			}
		});
	}

	static stringifyEscaped(obj) {
		return JSON.stringify(obj).replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
	}
}

class BaseBuilder {
	constructor() {
		this._title = '';
		this._subtitle = '';
		this._body = '';
		this._footer = '';
		this._contextInfo = {};
		this._extraPayload = {};
	}

	setTitle(title) {
		if (typeof title !== 'string') {
			throw new TypeError('Title must be a string');
		}
		this._title = title;
		return this;
	}

	setSubtitle(subtitle) {
		if (typeof subtitle !== 'string') {
			throw new TypeError('Subtitle must be a string');
		}
		this._subtitle = subtitle;
		return this;
	}

	setBody(body) {
		if (typeof body !== 'string') {
			throw new TypeError('Body must be a string');
		}
		this._body = body;
		return this;
	}

	setFooter(footer) {
		if (typeof footer !== 'string') {
			throw new TypeError('Footer must be a string');
		}
		this._footer = footer;
		return this;
	}

	setContextInfo(obj) {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
			throw new TypeError('ContextInfo must be a plain object');
		}

		this._contextInfo = obj;
		return this;
	}

	addPayload(obj) {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
			throw new TypeError('Payload must be a plain object');
		}

		Object.assign(this._extraPayload, obj);

		return this;
	}

	// --- hsnai convenience shortcuts (kept from the earlier port) ---
	text(t) {
		return this.setBody(t);
	}
	footer(f) {
		return this.setFooter(f);
	}
	title(t) {
		return this.setTitle(t);
	}
	subtitle(s) {
		return this.setSubtitle(s);
	}
	image(url, opts = {}) {
		if (this.setImage) return this.setImage(url, opts);
		if (this.setThumbnail) return this.setThumbnail(url);
		if (this.addImage) return this.addImage(url, opts);
		return this;
	}
}

class Button extends BaseBuilder {
	#client;

	constructor(client) {
		super();
		if (!client) {
			throw new Error('Socket is required');
		}
		this.#client = client;

		this._buttons = [];
		this._data;
		this._currentSelectionIndex = -1;
		this._currentSectionIndex = -1;
		this._params = {};
	}

	loadFrom(msg) {
		if (!msg) throw new Error('interactiveMessage needed');
		if (!msg.interactiveMessage) throw new Error('interactiveMessage not found');

		const { interactiveMessage, ...extraPayload } = msg;
		const iM = interactiveMessage;
		const header = iM.header || {};
		const nativeFlow = iM.nativeFlowMessage || {};

		this._title = header.title || '';
		this._subtitle = header.subtitle || '';
		this._body = iM.body?.text || '';
		this._footer = iM.footer?.text || '';
		this._contextInfo = iM.contextInfo || {};
		this._extraPayload = extraPayload;

		this._buttons = Array.isArray(nativeFlow.buttons)
			? nativeFlow.buttons.map((button) => ({
					...button,
					buttonParamsJson: typeof button.buttonParamsJson === 'string' ? button.buttonParamsJson : JSON.stringify(button.buttonParamsJson || {}),
				}))
			: [];

		this._data = header.imageMessage
			? { imageMessage: header.imageMessage }
			: header.videoMessage
				? { videoMessage: header.videoMessage }
				: header.documentMessage
					? { documentMessage: header.documentMessage }
					: header.productMessage
						? { productMessage: header.productMessage }
						: undefined;

		this._params = {};

		if (typeof nativeFlow.messageParamsJson === 'string') {
			try {
				this._params = JSON.parse(nativeFlow.messageParamsJson || '{}');
			} catch {
				this._params = {};
			}
		} else if (nativeFlow.messageParamsJson && typeof nativeFlow.messageParamsJson === 'object') {
			this._params = { ...nativeFlow.messageParamsJson };
		}

		this._currentSelectionIndex = this._buttons.findLastIndex((button) => button.name === 'single_select');

		this._currentSectionIndex = -1;

		if (this._currentSelectionIndex !== -1) {
			try {
				const button = this._buttons[this._currentSelectionIndex];
				const params = JSON.parse(button.buttonParamsJson || '{}');

				if (Array.isArray(params.sections) && params.sections.length) {
					this._currentSectionIndex = params.sections.length - 1;
				}
			} catch {
				this._currentSelectionIndex = -1;
				this._currentSectionIndex = -1;
			}
		}

		return this;
	}

	setImage(path, options = {}) {
		if (!path) throw new Error('Url or buffer needed');
		Buffer.isBuffer(path) ? (this._data = { image: path, ...options }) : (this._data = { image: { url: path }, ...options });
		return this;
	}

	setDocument(path, options = {}) {
		if (!path) throw new Error('Url or buffer needed');
		Buffer.isBuffer(path) ? (this._data = { document: path, ...options }) : (this._data = { document: { url: path }, ...options });
		return this;
	}

	setMedia(obj) {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
			throw new TypeError('Media must be a plain object');
		}

		this._data = obj;
		return this;
	}

	clearButtons() {
		this._buttons = [];
		return this;
	}

	setParams(obj) {
		this._params = obj;
		return this;
	}

	addButton(name, params) {
		this._buttons.push({
			name,
			buttonParamsJson: typeof params === 'string' ? params : JSON.stringify(params),
		});

		return this;
	}

	makeRow(header = '', title = '', description = '', id = '') {
		if (this._currentSelectionIndex === -1 || this._currentSectionIndex === -1) {
			throw new Error('You need to create a selection and a section first');
		}
		const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
		buttonParams.sections[this._currentSectionIndex].rows.push({ header, title, description, id });
		this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
		return this;
	}

	makeSection(title = '', highlight_label = '') {
		if (this._currentSelectionIndex === -1) {
			throw new Error('You need to create a selection first');
		}
		const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
		buttonParams.sections.push({ title, highlight_label, rows: [] });
		this._currentSectionIndex = buttonParams.sections.length - 1;
		this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
		return this;
	}

	addSelection(title, options = {}) {
		this._buttons.push({ name: 'single_select', buttonParamsJson: JSON.stringify({ title, sections: [], ...options }) });
		this._currentSelectionIndex = this._buttons.length - 1;
		this._currentSectionIndex = -1;
		return this;
	}

	addReply(display_text = '', id = '', options = {}) {
		this._buttons.push({
			name: 'quick_reply',
			buttonParamsJson: JSON.stringify({
				display_text,
				id,
				...options,
			}),
		});
		return this;
	}

	addCall(display_text = '', id = '', options = {}) {
		this._buttons.push({
			name: 'cta_call',
			buttonParamsJson: JSON.stringify({
				display_text,
				id,
				...options,
			}),
		});
		return this;
	}

	addReminder(display_text = '', id = '', options = {}) {
		this._buttons.push({
			name: 'cta_reminder',
			buttonParamsJson: JSON.stringify({
				display_text,
				id,
				...options,
			}),
		});
		return this;
	}

	addCancelReminder(display_text = '', id = '', options = {}) {
		this._buttons.push({
			name: 'cta_cancel_reminder',
			buttonParamsJson: JSON.stringify({
				display_text,
				id,
				...options,
			}),
		});
		return this;
	}

	addAddress(display_text = '', id = '', options = {}) {
		this._buttons.push({
			name: 'address_message',
			buttonParamsJson: JSON.stringify({
				display_text,
				id,
				...options,
			}),
		});
		return this;
	}

	addLocation(options = {}) {
		this._buttons.push({
			name: 'send_location',
			buttonParamsJson: JSON.stringify(options),
		});
		return this;
	}

	addUrl(display_text = '', url = '', webview_interaction = false, options = {}) {
		this._buttons.push({
			...options,
			name: 'cta_url',
			buttonParamsJson: JSON.stringify({
				display_text,
				url,
				webview_interaction,
				...options,
			}),
		});
		return this;
	}

	addCopy(display_text = '', copy_code = '', options = {}) {
		this._buttons.push({
			name: 'cta_copy',
			buttonParamsJson: JSON.stringify({
				display_text,
				copy_code,
				...options,
			}),
		});
		return this;
	}

	static paramsList = {
		limited_time_offer: {
			text: 'string',
			url: 'string',
			copy_code: 'string',
			expiration_time: 'number',
		},
		bottom_sheet: {
			in_thread_buttons_limit: 'number',
			divider_indices: ['number'],
			list_title: 'string',
			button_title: 'string',
		},
		tap_target_configuration: {
			title: 'string',
			description: 'string',
			canonical_url: 'string',
			domain: 'string',
			buttonIndex: 'number',
		},
	};

	async toCard() {
		return {
			body: {
				text: this._body,
			},
			footer: {
				text: this._footer,
			},
			header: {
				title: this._title,
				subtitle: this._subtitle,
				hasMediaAttachment: !!this._data,
				...(this._data
					? await prepareWAMessageMedia(this._data, { upload: this.#client.waUploadToServer }).catch((e) => {
							if (String(e).includes('Invalid media type')) return this._data;
							throw e;
						})
					: {}),
			},
			nativeFlowMessage: {
				messageParamsJson: JSON.stringify(this._params),
				buttons: this._buttons,
			},
		};
	}

	async build(jid, { messageId, ...options } = {}) {
		const message = await this.toCard();

		return generateWAMessageFromContent(
			jid,
			{
				...this._extraPayload,
				interactiveMessage: {
					...message,
					contextInfo: this._contextInfo,
				},
			},
			{ messageId: messageId || generateMessageIDV2(), ...options }
		);
	}

	async send(jid, { messageId, additionalNodes = [], ...options } = {}) {
		const msg = await this.build(jid, { messageId, ...options });

		await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [
				{
					tag: 'biz',
					attrs: {},
					content: [
						{
							tag: 'interactive',
							attrs: { type: 'native_flow', v: '1' },
							content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
						},
					],
				},
				...additionalNodes,
			],
			...options,
		});
		return msg;
	}
}

class ButtonV2 extends BaseBuilder {
	#client;

	constructor(client) {
		super();
		if (!client) {
			throw new Error('Socket is required');
		}

		this.#client = client;
		this._image;
		this._data;
		this._buttons = [];
	}

	loadFrom(msg) {
		if (!msg) throw new Error('buttonsMessage needed');
		if (!msg.buttonsMessage) throw new Error('buttonsMessage not found');

		const { buttonsMessage, ...extraPayload } = msg;
		const bM = buttonsMessage;
		const location = bM.locationMessage || {};

		this._title = location.name || '';
		this._subtitle = location.address || '';
		this._body = bM.contentText || '';
		this._footer = bM.footerText || '';
		this._contextInfo = bM.contextInfo || {};
		this._extraPayload = extraPayload;

		this._buttons = Array.isArray(bM.buttons)
			? bM.buttons.map((button) => ({
					...button,
					...(button.nativeFlowInfo
						? {
								nativeFlowInfo: {
									...button.nativeFlowInfo,
									paramsJson: typeof button.nativeFlowInfo.paramsJson === 'string' ? button.nativeFlowInfo.paramsJson : JSON.stringify(button.nativeFlowInfo.paramsJson || {}),
								},
							}
						: {}),
				}))
			: [];

		this._image = location.jpegThumbnail || undefined;

		if (!this._image && bM.locationMessage) {
			this._image = undefined;
		}

		if (!bM.locationMessage && bM.headerType === 6) {
			this._image = undefined;
		}

		this._data = Object.keys(bM).reduce((data, key) => {
			if (!['contentText', 'footerText', 'contextInfo', 'buttons', 'headerType', 'locationMessage', 'viewOnce'].includes(key)) {
				data[key] = bM[key];
			}
			return data;
		}, {});

		if (!Object.keys(this._data).length) {
			this._data = undefined;
		}

		return this;
	}

	addButton(displayText = '', buttonId = crypto.randomUUID()) {
		this._buttons.push({
			buttonId,
			buttonText: { displayText },
			type: 1,
		});
		return this;
	}

	addRawButton(obj) {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
			throw new TypeError('Buttons must be a plain object');
		}

		this._buttons.push(obj);
		return this;
	}

	setRawThumbnail(thumbnail) {
		if (!thumbnail) throw new Error('Thumbnail needed');
		this._image = { base64: thumbnail, is_raw: true };
		return this;
	}

	setThumbnail(path) {
		if (!path) throw new Error('Url or buffer needed');
		this._image = path;
		return this;
	}

	setMedia(obj) {
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
			throw new TypeError('Media must be a plain object');
		}

		this._data = obj;
		return this;
	}

	async build(jid, { messageId, ...options } = {}) {
		const _thumbnail = this._image?.is_raw
			? this._image.base64
			: this._image
				? await Toolkit.resize(Buffer.isBuffer(this._image) ? this._image : await Toolkit.fetchBuffer(this._image, {}, { silent: true }), 300, 300)
				: null;
		const msg = generateWAMessageFromContent(
			jid,
			{
				...this._extraPayload,
				buttonsMessage: {
					contentText: this._body,
					footerText: this._footer,
					...(this._data
						? this._data
						: {
								headerType: 6,
								locationMessage: {
									degreesLatitude: 0,
									degreesLongitude: 0,
									name: this._title,
									address: this._subtitle,
									jpegThumbnail: _thumbnail,
								},
							}),
					viewOnce: true,
					contextInfo: this._contextInfo,
					buttons: [...this._buttons],
				},
			},
			{ messageId: messageId || generateMessageIDV2(), ...options }
		);
		return msg;
	}

	async send(jid, { messageId, additionalNodes = [], ...options } = {}) {
		if (this._buttons.length < 1) throw new Error('ButtonV2 requires at least one button');
		const msg = await this.build(jid, { messageId, ...options });

		await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [
				{
					tag: 'biz',
					attrs: {},
					content: [
						{
							tag: 'interactive',
							attrs: { type: 'native_flow', v: '1' },
							content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
						},
					],
				},
				...additionalNodes,
			],
			...options,
		});
		return msg;
	}
}

class Carousel extends BaseBuilder {
	#client;

	constructor(client) {
		super();
		if (!client) {
			throw new Error('Socket is required');
		}

		this.#client = client;
		this._cards = [];
	}

	loadFrom(msg) {
		if (!msg) throw new Error('interactiveMessage needed');
		if (!msg.interactiveMessage) throw new Error('interactiveMessage not found');

		const { interactiveMessage, ...extraPayload } = msg;
		const iM = interactiveMessage;
		const carousel = iM.carouselMessage || {};

		this._body = iM.body?.text || '';
		this._footer = iM.footer?.text || '';
		this._contextInfo = iM.contextInfo || {};
		this._extraPayload = extraPayload;

		this._cards = Array.isArray(carousel.cards)
			? carousel.cards.map((card) => ({
					...card,
					header: {
						...(card.header || {}),
						hasMediaAttachment: !!card.header?.hasMediaAttachment,
						...(card.header?.imageMessage ? { imageMessage: card.header.imageMessage } : {}),
						...(card.header?.videoMessage ? { videoMessage: card.header.videoMessage } : {}),
					},
					body: {
						text: card.body?.text || '',
					},
					footer: {
						text: card.footer?.text || '',
					},
					nativeFlowMessage: {
						...(card.nativeFlowMessage || {}),
						buttons: Array.isArray(card.nativeFlowMessage?.buttons)
							? card.nativeFlowMessage.buttons.map((button) => ({
									...button,
									buttonParamsJson: typeof button.buttonParamsJson === 'string' ? button.buttonParamsJson : JSON.stringify(button.buttonParamsJson || {}),
								}))
							: [],
						messageParamsJson:
							typeof card.nativeFlowMessage?.messageParamsJson === 'string' ? card.nativeFlowMessage.messageParamsJson : JSON.stringify(card.nativeFlowMessage?.messageParamsJson || {}),
					},
				}))
			: [];

		return this;
	}

	addCard(card) {
		const cards = Array.isArray(card) ? card : [card];
		const baseIndex = this._cards.length;

		for (const [index, c] of cards.entries()) {
			if (!c?.header?.hasMediaAttachment) {
				throw new Error(`Card [${baseIndex + index}] must include an image or video in header`);
			}
		}

		this._cards.push(...cards);
		return this;
	}

	build(jid, { messageId, ...options } = {}) {
		return generateWAMessageFromContent(
			jid,
			{
				...this._extraPayload,
				interactiveMessage: {
					header: {
						hasMediaAttachment: false,
					},
					body: { text: this._body },
					footer: { text: this._footer },
					contextInfo: this._contextInfo,
					carouselMessage: {
						cards: this._cards,
					},
				},
			},
			{ messageId: messageId || generateMessageIDV2(), ...options }
		);
	}

	async send(jid, { messageId, additionalNodes = [], ...options } = {}) {
		const msg = this.build(jid, { messageId, ...options });

		await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
			messageId: msg.key.id,
			additionalNodes: [
				{
					tag: 'biz',
					attrs: {},
					content: [
						{
							tag: 'interactive',
							attrs: { type: 'native_flow', v: '1' },
							content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
						},
					],
				},
				...additionalNodes,
			],
			...options,
		});
		return msg;
	}
}

class AIRich extends BaseBuilder {
	#client;

	constructor(client, { dynamic = true, unsupportedTypeAlert = true } = {}) {
		if (!client) {
			throw new Error('Socket is required');
		}

		super();
		this.#client = client;
		this._contextInfo = {};
		this._nodes = [];
		this._idIndex = new Map();
		this._unsupportedTypeAlert = !!unsupportedTypeAlert;
		this._dynamic = !!dynamic;
		this._responseId = crypto.randomUUID();
		this._botResponseId = crypto.randomUUID();
		this._lastMessageKey = null;
	}

	loadFrom(msg) {
		if (!msg) throw new Error('AI Rich message needed');

		const message = msg.message ?? msg;

		let richResponseMessage = message?.botForwardedMessage?.message?.richResponseMessage;

		if (!richResponseMessage) {
			richResponseMessage = message?.botForwardedMessage?.richResponseMessage;
		}

		if (!richResponseMessage) {
			richResponseMessage = message?.richResponseMessage;
		}

		if (!richResponseMessage) {
			throw new Error('richResponseMessage not found');
		}

		const messageContextInfo = message?.messageContextInfo ?? {};
		const botMetadata = messageContextInfo?.botMetadata ?? {};

		this._title = botMetadata?.messageDisclaimerText ?? '';

		this._contextInfo = structuredClone(richResponseMessage?.contextInfo ?? {});

		const loadedSubmessages = Array.isArray(richResponseMessage?.submessages) ? structuredClone(richResponseMessage.submessages) : [];

		let loadedSections = [];

		const unifiedData = richResponseMessage?.unifiedResponse?.data;

		if (unifiedData) {
			try {
				const decoded = Buffer.from(unifiedData, 'base64').toString('utf8');
				const unifiedResponse = JSON.parse(decoded);

				if (Array.isArray(unifiedResponse?.sections)) {
					loadedSections = structuredClone(unifiedResponse.sections);
				}
			} catch {}
		}

		this._nodes = [];
		this._idIndex = new Map();

		const maxLength = Math.max(loadedSections.length, loadedSubmessages.length);

		for (let i = 0; i < maxLength; i++) {
			this._nodes.push({
				id: null,
				section: loadedSections[i] ?? null,
				submessage: loadedSubmessages[i] ?? null,
			});
		}

		this._extraPayload = {};

		for (const [key, value] of Object.entries(message)) {
			if (key !== 'messageContextInfo' && key !== 'botForwardedMessage' && key !== 'richResponseMessage') {
				this._extraPayload[key] = structuredClone(value);
			}
		}

		return this;
	}

	setResponseId(id) {
		if (typeof id !== 'string') {
			throw new TypeError('ID must be a string');
		}
		this._responseId = id;

		return this;
	}

	refreshResponseId() {
		this._responseId = crypto.randomUUID();

		return this;
	}

	setBotResponseId(id) {
		if (typeof id !== 'string') {
			throw new TypeError('ID must be a string');
		}
		this._botResponseId = id;

		return this;
	}

	refreshBotResponseId() {
		this._botResponseId = crypto.randomUUID();

		return this;
	}

	createAlert(type) {
		if (this._unsupportedTypeAlert) {
			return {
				messageType: 2,
				messageText: `[ UNSUPPORTED_TYPE - ${type}]`,
			};
		}

		return undefined;
	}

	addText(text, { hyperlink = true, citation = true, latex = true, id, replace, insertAt } = {}) {
		if (typeof text !== 'string') {
			throw new TypeError('Text must be a string');
		}

		const { text: extractedText, inline_entities } = extractIE(text, {
			hyperlink,
			citation,
			latex,
		});

		const section = AIRich.newLayout('Single', {
			text: extractedText,
			...(inline_entities.length && { inline_entities }),
			__typename: 'GenAIMarkdownTextUXPrimitive',
		});

		const submessages = [
			{
				messageType: 2,
				messageText: text,
			},
		].filter(Boolean);

		return this._addContent(section, submessages, {
			id,
			replace,
			insertAt,
		});
	}

	addFOAText(text, { id, replace, insertAt } = {}) {
		if (typeof text !== 'string') {
			throw new TypeError('Text must be a string');
		}

		const section = AIRich.newLayout('Single', {
			text,
			__typename: 'FOATextPrimitive',
		});

		const submessages = [
			{
				messageType: 2,
				messageText: text,
			},
		];

		return this._addContent(section, submessages, {
			id,
			replace,
			insertAt,
		});
	}

	addCode(language, code, { id, replace, insertAt } = {}) {
		if (typeof language !== 'string' || typeof code !== 'string') {
			throw new TypeError('Language and code must be a string');
		}

		const meta = AIRich.tokenizer(code, language);

		const section = AIRich.newLayout('Single', {
			language,
			code_blocks: meta.unified_codeBlock,
			__typename: 'GenAICodeUXPrimitive',
		});

		const submessages = [
			{
				messageType: 5,
				codeMetadata: {
					codeLanguage: language,
					codeBlocks: meta.codeBlock,
				},
			},
		];

		return this._addContent(section, submessages, {
			id,
			replace,
			insertAt,
		});
	}

	addTable(table, { hyperlink = true, citation = true, latex = true, id, replace, insertAt } = {}) {
		if (!Array.isArray(table)) {
			throw new TypeError('Table must be an array');
		}

		const meta = AIRich.toTableMetadata(table, {
			hyperlink,
			citation,
			latex,
		});

		const section = AIRich.newLayout('Single', {
			rows: meta.unified_rows,
			__typename: 'GenATableUXPrimitive',
		});

		const submessages = [
			{
				messageType: 4,
				tableMetadata: {
					title: meta.title,
					rows: meta.rows,
				},
			},
		];

		return this._addContent(section, submessages, {
			id,
			replace,
			insertAt,
		});
	}

	addSource(sources = [], { id, replace, insertAt } = {}) {
		if (!Array.isArray(sources)) {
			throw new TypeError('Sources must be an array of strings, arrays, or objects');
		}

		const isStringArray = sources.every((item) => typeof item === 'string');

		const isArrayFormat = sources.every((item) => Array.isArray(item) && item.every((value) => typeof value === 'string'));

		const isObjectFormat = sources.every((item) => item && typeof item === 'object' && !Array.isArray(item));

		if (!isStringArray && !isArrayFormat && !isObjectFormat) {
			throw new TypeError('Sources must be a string array, array of string arrays, or array of objects');
		}

		if (isStringArray) {
			sources = [sources];
		}

		const normalizedSources = sources.map((source) => {
			if (Array.isArray(source)) {
				const [icon, url, title, subtitle] = source;

				return {
					icon,
					url,
					title,
					subtitle,
				};
			}

			return {
				icon: source.favicon ?? source.icon ?? '',
				url: source.url ?? '',
				title: source.title ?? '',
				subtitle: source.subtitle ?? '',
			};
		});

		const source = normalizedSources.map(({ icon, url, title, subtitle }) => ({
			source_type: 'THIRD_PARTY',
			source_display_name: title,
			source_subtitle: subtitle,
			source_url: url,
			favicon: {
				url: Toolkit.resolveMedia(this.#client, icon, 'image'),
				mime_type: 'image/jpeg',
				width: 16,
				height: 16,
			},
		}));

		const submessage = this.createAlert('GenAISearchResultPrimitive');

		const section = AIRich.newLayout('Single', {
			sources: source,
			__typename: 'GenAISearchResultPrimitive',
		});

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addReels(reelsItems = [], { id, replace, insertAt } = {}) {
		if (
			!(
				(reelsItems && typeof reelsItems === 'object' && !Array.isArray(reelsItems)) ||
				(Array.isArray(reelsItems) && reelsItems.every((item) => item && typeof item === 'object' && !Array.isArray(item)))
			)
		) {
			throw new TypeError('Reels items must be an object or an array of objects');
		}

		const items = Array.isArray(reelsItems) ? reelsItems : [reelsItems];

		const reels = items.map((item) => ({
			...item,
			_avatar: Toolkit.resolveMedia(this.#client, item.profileIconUrl ?? item.profile_url ?? item.profile ?? '', 'image'),
			_thumbnail: Toolkit.resolveMedia(this.#client, item.thumbnailUrl ?? item.thumbnail ?? '', 'image'),
		}));

		const section = AIRich.newLayout(
			'HScroll',
			reels.map((item) => ({
				reels_url: item.videoUrl ?? item.url ?? '',
				thumbnail_url: item._thumbnail,
				creator: item.username ?? item.title ?? '',
				avatar_url: item._avatar,
				reels_title: item.reels_title ?? item.title ?? '',
				likes_count: item.likes_count ?? item.like ?? 0,
				shares_count: item.shares_count ?? item.share ?? 0,
				view_count: item.view_count ?? item.view ?? 0,
				reel_source: item.reel_source ?? item.source ?? 'IG',
				is_verified: !!(item.is_verified || item.verified),
				__typename: 'GenAIReelPrimitive',
			}))
		);

		const submessages = [
			{
				messageType: 9,
				contentItemsMetadata: {
					contentType: 1,
					itemsMetadata: reels.map((item) => ({
						reelItem: {
							title: item.username ?? '',
							profileIconUrl: item._avatar,
							thumbnailUrl: item._thumbnail,
							videoUrl: item.videoUrl ?? item.url ?? '',
						},
					})),
				},
			},
		];

		return this._addContent(section, submessages, {
			id,
			replace,
			insertAt,
		});
	}

	addImage(imageUrl, { width, height, status = 'READY', update_text, resolveUrl = false, id, replace, insertAt } = {}) {
		if (!(typeof imageUrl === 'string' || Buffer.isBuffer(imageUrl) || (Array.isArray(imageUrl) && imageUrl.every((v) => typeof v === 'string' || Buffer.isBuffer(v))))) {
			throw new TypeError('imageUrl must be string | buffer | array of string/buffer');
		}

		const list = Array.isArray(imageUrl)
			? imageUrl.map((v) => {
					const url = Toolkit.resolveMedia(this.#client, v, 'image', { resolveUrl });

					return {
						imagePreviewUrl: url,
						imageHighResUrl: url,
						sourceUrl: url,
					};
				})
			: (() => {
					const url = Toolkit.resolveMedia(this.#client, imageUrl, 'image', { resolveUrl });

					return [
						{
							imagePreviewUrl: url,
							imageHighResUrl: url,
							sourceUrl: url,
						},
					];
				})();

		const sections = list.map(({ imagePreviewUrl }) =>
			AIRich.newLayout('Single', {
				media: {
					url: imagePreviewUrl,
					mime_type: 'image/png',
					width,
					height,
				},
				imagine_type: 'IMAGE',
				status: {
					status,
					update_text,
				},
				__typename: 'GenAIImaginePrimitive',
			})
		);

		const submessage = {
			messageType: 1,
			gridImageMetadata: {
				gridImageUrl: {
					imagePreviewUrl: list[0]?.imagePreviewUrl,
				},
				imageUrls: list,
			},
		};

		if (id && sections.length !== 1) {
			throw new Error('Cannot assign one id to multiple image sections');
		}

		return this._addContent(sections, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addVideo(videoUrl, { autoFill = true, status = 'READY', estimatedTime, width, height, id, replace, insertAt } = {}) {
		// [hsnai] width/height opsional (mis. 1280x720 = 16:9). Dipakai untuk rasio thumbnail & media.
		const hasSize = Number(width) > 0 && Number(height) > 0;
		const thumbW = hasSize ? 480 : 300;
		const thumbH = hasSize ? Math.round((480 * Number(height)) / Number(width)) : 300;

		const isObjectVideo = (v) => v && typeof v === 'object' && !Array.isArray(v) && v.url;

		const isValidPrimitive =
			typeof videoUrl === 'string' ||
			Buffer.isBuffer(videoUrl) ||
			isObjectVideo(videoUrl) ||
			(Array.isArray(videoUrl) && videoUrl.every((v) => typeof v === 'string' || Buffer.isBuffer(v) || isObjectVideo(v)));

		if (!isValidPrimitive) {
			throw new TypeError('videoUrl must be string | buffer | object | array');
		}

		const items = Array.isArray(videoUrl) ? videoUrl : [videoUrl];

		const alert = this.createAlert('GenAIImaginePrimitive (ANIMATE)');

		const sections = [];
		const submessages = [];

		for (const item of items) {
			const isObject = isObjectVideo(item);

			const url = isObject ? Toolkit.resolveMedia(this.#client, item.url ?? '', 'video') : Toolkit.resolveMedia(this.#client, item, 'video');

			const bufferPromise = autoFill ? Promise.resolve(url).then((u) => Toolkit.fetchBuffer(u)) : null;

			const file_length = isObject && item.file_length != null ? item.file_length : autoFill ? bufferPromise.then((b) => b?.length ?? 0) : 0;

			const duration =
				isObject && item.duration != null
					? item.duration
					: autoFill
						? bufferPromise.then((b) =>
								Toolkit.getMp4Duration(b, {
									silent: true,
								})
							)
						: 0;

			const thumbnail =
				isObject && item.thumbnail
					? Toolkit.resolveMedia(this.#client, item.thumbnail, 'image', {
							result: 'base64',
							resize: true,
							width: thumbW,
							height: thumbH,
						})
					: autoFill
						? bufferPromise?.then((b) =>
								Toolkit.getMp4Preview(b, {
									time: 0,
									result: 'base64',
									width: thumbW,
									height: thumbH,
								})
							)
						: null;

			sections.push(
				AIRich.newLayout('Single', {
					media: {
						url,
						mime_type: isObject ? (item.mime_type ?? 'video/mp4') : 'video/mp4',
						file_length,
						duration,
						...(hasSize ? { width: Number(width), height: Number(height) } : {}),
					},
					imagine_type: 'ANIMATE',
					status: {
						status,
						estimated_completion_time: estimatedTime != null ? Math.floor((Date.now() + estimatedTime) / 1000) : undefined,
					},
					thumbnail: {
						raw_media: thumbnail,
					},
					__typename: 'GenAIImaginePrimitive',
				})
			);
		}

		if (alert !== undefined) {
			submessages.push(alert);
		}

		if (submessages.length > 1) {
			throw new Error('Video content can only have one submessage');
		}

		return this._addContent(sections, submessages[0], {
			id,
			replace,
			insertAt,
		});
	}

	addProduct(data = {}, { id, replace, insertAt } = {}) {
		if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && data.every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
			throw new TypeError('Product items must be an object or an array of objects');
		}

		const items = Array.isArray(data) ? data : [data];

		const product = items.map((item) => ({
			title: item.title,
			brand: item.brand,
			price: item.price,
			sale_price: item.sale_price,
			product_url: item.product_url ?? item.url,
			image: {
				url: Toolkit.resolveMedia(this.#client, item.image_url ?? item.image, 'image'),
			},
			additional_images: [
				{
					url: Toolkit.resolveMedia(this.#client, item.icon_url ?? item.icon, 'image'),
				},
			],
			__typename: 'GenAIProductItemCardPrimitive',
		}));

		const section = AIRich.newLayout(Array.isArray(data) ? 'HScroll' : 'Single', Array.isArray(data) ? product : product[0]);

		const submessage = this.createAlert('GenAIProductItemCardPrimitive');

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addPost(data = {}, { id, replace, insertAt } = {}) {
		if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && data.every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
			throw new TypeError('Post items must be an object or an array of objects');
		}

		const posts = Array.isArray(data) ? data : [data];

		const primitives = posts.map((p) => ({
			title: p.title ?? '',
			subtitle: p.subtitle ?? '',
			username: p.username ?? '',
			profile_picture_url: Toolkit.resolveMedia(this.#client, p.profile_picture_url ?? p.profile_url ?? p.profile ?? '', 'image'),
			is_verified: !!(p.is_verified || p.verified),
			thumbnail_url: Toolkit.resolveMedia(this.#client, p.thumbnail_url ?? p.thumbnail ?? '', 'image'),
			post_caption: p.post_caption ?? p.caption ?? '',
			likes_count: p.likes_count ?? p.like ?? 0,
			comments_count: p.comments_count ?? p.comment ?? 0,
			shares_count: p.shares_count ?? p.share ?? 0,
			post_url: p.post_url ?? p.url ?? '',
			post_deeplink: p.post_deeplink ?? p.deeplink ?? '',
			source_app: p.source_app || p.source || 'INSTAGRAM',
			footer_label: p.footer_label ?? p.footer ?? '',
			footer_icon: Toolkit.resolveMedia(this.#client, p.footer_icon ?? p.icon ?? '', 'image'),
			is_carousel: posts.length > 1,
			orientation: p.orientation ?? 'LANDSCAPE',
			post_type: p.post_type ?? 'VIDEO',
			__typename: 'GenAIPostPrimitive',
		}));

		const section = AIRich.newLayout('HScroll', primitives);

		const submessage = this.createAlert('GenAIPostPrimitive');

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addMetadata(text, { id, replace, insertAt } = {}) {
		if (typeof text !== 'string') {
			throw new TypeError('Text must be a string');
		}

		const section = AIRich.newLayout('Single', {
			text,
			__typename: 'GenAIMetadataTextPrimitive',
		});

		const submessage = {
			messageType: 2,
			messageText: text,
		};

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addTip(text, { id, replace, insertAt } = {}) {
		if (typeof text !== 'string') {
			throw new TypeError('Text must be a string');
		}

		const section = AIRich.newLayout('Single', {
			text: 'ⓘ ' + text,
			__typename: 'GenAIMetadataTextPrimitive',
		});

		const submessage = {
			messageType: 2,
			messageText: text,
		};

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addWidget(data, { layout, id, replace, insertAt, ...options } = {}) {
		if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && data.every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
			throw new TypeError('Widget must be an object or an array of objects');
		}

		const isArray = Array.isArray(data);

		const items = isArray ? data : [data];

		const widgets = items.map((item) => ({
			__typename: 'GenAI3PExtWidgetPrimitive',

			header: {
				__typename: 'GenAI3PExtWidgetStandardHeader',
				title: item.title ?? '',
				...(item.header ?? {}),
			},

			body: {
				__typename: 'GenAI3PExtCalendarEventList',
				sections: item.sections ?? [],

				ctas: (item.actions ?? []).map((action) => ({
					__typename: 'GenAI3PExtWidgetCTA',
					label: action.label ?? '',
					state: action.state ?? 'PENDING',
					kind: action.kind ?? 'OTHER',
					tool_call_id: action.tool_call_id ?? action.id ?? '',

					...(action.toast && {
						toast: {
							__typename: 'GenAI3PExtWidgetToast',
							label: action.toast.label ?? action.label ?? '',
						},
					}),
				})),

				...(item.body ?? {}),
			},
		}));

		const section = AIRich.newLayout(layout ?? (isArray ? 'HScroll' : 'Single'), isArray ? widgets : widgets[0], options);

		const submessage = this.createAlert('GenAI3PExtWidgetStandardHeader');

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addFooterAction(data, { layout, id, replace, insertAt, ...options } = {}) {
		if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && data.every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
			throw new TypeError('Footer action must be an object or an array of objects');
		}

		const isArray = Array.isArray(data);

		const items = isArray ? data : [data];

		const actions = items.map((item) => ({
			__typename: 'GenAIFooterActionPrimitive',

			cta_text: item.text ?? item.cta_text ?? '',

			cta_type: item.type ?? item.cta_type ?? 'OPEN_URL',

			cta_url: item.url ?? item.cta_url ?? '',
		}));

		const section = AIRich.newLayout(layout ?? (isArray ? 'HScroll' : 'Single'), isArray ? actions : actions[0], options);

		const submessage = this.createAlert('GenAIFooterActionPrimitive');

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	addSuggest(suggestion, { scroll = true, layout, id, replace, insertAt } = {}) {
		if (!(typeof suggestion === 'string' || (Array.isArray(suggestion) && suggestion.every((v) => typeof v === 'string')))) {
			throw new TypeError('Suggestion must be a string or array of strings');
		}

		const suggest = Array.isArray(suggestion)
			? suggestion.map((text) => ({
					prompt_text: text,
					prompt_type: 'SUGGESTED_PROMPT',
					__typename: 'GenAIFollowUpSuggestionPillPrimitive',
				}))
			: [
					{
						prompt_text: suggestion,
						prompt_type: 'SUGGESTED_PROMPT',
						__typename: 'GenAIFollowUpSuggestionPillPrimitive',
					},
				];

		const type = layout ?? (suggest.length === 1 ? 'Single' : scroll ? 'HScroll' : 'ActionRow');

		const section = AIRich.newLayout(type, type === 'Single' ? suggest[0] : suggest, {
			__typename: 'GenAIUnifiedResponseSection',
		});

		const submessage = this.createAlert('GenAIFollowUpSuggestionPillPrimitive');

		return this._addContent(section, submessage, {
			id,
			replace,
			insertAt,
		});
	}

	async build(
		jid,
		{
			bypassDownload = true,
			forwarded = true,
			notification = false,
			includesUnifiedResponse = true,
			includesSubmessages = true,
			includesVerification = false,
			quoted,
			quotedParticipant,
			messageId,
			...options
		} = {}
	) {
		const forward = forwarded
			? {
					forwardingScore: 1,
					isForwarded: true,
					forwardedAiBotMessageInfo: { botJid: '0@bot' },
					forwardOrigin: 4,
				}
			: {};

		const notif = notification
			? {
					sessionTransparencyMetadata: {
						disclaimerText: '~ Ahmad tumbuh kembang',
						hcaId: `hca_${Date.now()}`,
						sessionTransparencyType: 1,
					},
				}
			: {};

		const qObj = quoted
			? {
					stanzaId: quoted?.key?.id || quoted?.id,
					participant: quotedParticipant || quoted?.key?.participant || quoted?.participant || quoted?.key?.remoteJid,
					quotedType: 0,
					quotedMessage: typeof quoted === 'object' && quoted !== null ? (quoted.message ?? quoted) : undefined,
				}
			: {};

		const sections = this._footer
			? [
					...(await waitAllPromises(this._sections)),
					AIRich.newLayout('Single', {
						text: this._footer,
						__typename: 'GenAIMetadataTextPrimitive',
					}),
				]
			: [...(await waitAllPromises(this._sections))];

		if (this._dynamic) {
			this.refreshResponseId();
			this.refreshBotResponseId();
		}

		return generateWAMessageFromContent(
			jid,
			{
				messageContextInfo: {
					deviceListMetadata: {},
					deviceListMetadataVersion: 2,
					botMetadata: {
						messageDisclaimerText: this._title,
						...notif,
						...(includesVerification
							? {
									verificationMetadata: AIRich.generateVerificationMetadata(),
									botResponseId: this._botResponseId,
								}
							: {}),
					},
				},
				...this._extraPayload,
				botForwardedMessage: {
					message: {
						richResponseMessage: {
							messageType: 1,
							submessages: includesSubmessages ? await waitAllPromises(this._submessages) : [],
							unifiedResponse: {
								data: includesUnifiedResponse ? Buffer.from(Toolkit.stringifyEscaped({ response_id: this._responseId, sections })).toString('base64') : '',
							},
							contextInfo: {
								...forward,
								...qObj,
								...this._contextInfo,
							},
						},
					},
				},
			},
			{ messageId: messageId || generateMessageIDV2(), ...options }
		);
	}

	async buildEdit(targetJid, targetId, { msg, messageId, ...options } = {}) {
		if (!msg) {
			msg = (await this.build(targetJid, options)).message;
		}

		const editedMessage = msg;

		if (!editedMessage) {
			throw new Error('buildEdit: msg does not contain botForwardedMessage');
		}

		return generateWAMessageFromContent(
			targetJid,
			{
				botForwardedMessage: {
					message: {
						protocolMessage: {
							key: {
								remoteJid: targetJid,
								fromMe: true,
								id: targetId,
							},
							type: 14,
							editedMessage,
						},
					},
				},
			},
			{ messageId: messageId || generateMessageIDV2(), ...options }
		);
	}

	async sendEdit(jid, id, { msg, messageId, additionalNodes = [], ...options } = {}) {
		jid = jid ?? this._lastMessageKey?.remoteJid;
		id = id ?? this._lastMessageKey?.id;

		if (!jid) {
			throw new Error('JID is required');
		}

		if (!id) {
			throw new Error('Message id is required');
		}

		const msgEdit = await this.buildEdit(jid, id, {
			msg,
			messageId: messageId || generateMessageIDV2(),
			...options,
		});

		await this.#client.relayMessage(jid, msgEdit.message, {
			messageId: msgEdit.key.id,
			additionalNodes,
		});

		return msgEdit;
	}

	async send(jid, { bypassDownload = true, forwarded = true, notification = false, includesUnifiedResponse = true, includesSubmessages = true, messageId, additionalNodes = [], ...options } = {}) {
    const msg = await this.build(jid, {
        forwarded,
        notification,
        includesUnifiedResponse,
        includesSubmessages,
        messageId,
        ...options,
    });

    await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
        messageId: msg.key.id,
        additionalNodes,
        ...options,
    });

    console.log('[DEBUG AIRich.send] bypassDownload:', bypassDownload, '| includesUnifiedResponse:', includesUnifiedResponse) // <-- tambahin ini

    if (includesUnifiedResponse && bypassDownload) {
        await this.sendEdit(jid, msg.key.id, {
            msg: msg.message,
        });
    }

    this._lastMessageKey = msg.key;

    return msg;
}

	// hsnai convenience shortcut: on AIRich, "text" adds a content node
	// (unlike BaseBuilder's default, which sets a header/body string)
	text(t) {
		return this.addText(t);
	}

	static tokenizer(code, lang = 'javascript') {
		// reuses hsnai's own keyword-based tokenizer from Utils/rich-messages.js —
		// identical return shape ({ codeBlock, unified_codeBlock }) to the
		// upstream NIXCODE tokenizer, so no functional difference.
		return tokenizeCodeV2(code, lang);
	}

	static toTableMetadata(arr, { hyperlink = true, citation = true, latex = true } = {}) {
		if (!Array.isArray(arr) || !arr.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'))) {
			throw new TypeError('Table must be a nested array of strings');
		}

		const [header, ...rows] = arr;

		const maxLen = Math.max(header.length, ...rows.map((r) => r.length));

		const normalize = (r) => [...r, ...Array(maxLen - r.length).fill('')];

		const unified_rows = [
			{
				is_header: true,
				cells: normalize(header),
			},
			...rows.map((r) => ({
				is_header: false,
				cells: normalize(r),
			})),
		].map((row) => {
			const markdown_cells = row.cells.map((cell) => {
				const extracted = extractIE(cell, { hyperlink, citation, latex });

				return {
					text: extracted.text,
					...(extracted.inline_entities.length ? { inline_entities: extracted.inline_entities } : {}),
				};
			});

			return {
				...row,
				...(markdown_cells.some((c) => c.inline_entities?.length) ? { markdown_cells } : {}),
			};
		});

		const rowsMeta = unified_rows.map((r) => ({
			items: r.cells,
			...(r.is_header ? { isHeading: true } : {}),
		}));

		return {
			title: '',
			rows: rowsMeta,
			unified_rows,
		};
	}

	static generateVerificationMetadata() {
		const signatureMaterial = Buffer.from(`NIXEL.MessageBuilderV${VERSION}-VerificationSignature.Metadata`);

		const certificateMaterial = Buffer.from(`NIXEL.MessageBuilderV${VERSION}-CertificateChain.Metadata`);

		const signature = Buffer.concat([signatureMaterial, crypto.randomBytes(64 - signatureMaterial.length)]).toString('base64');

		const certificateChain = [
			Buffer.concat([certificateMaterial, crypto.randomBytes(684 - certificateMaterial.length)]).toString('base64'),

			Buffer.concat([certificateMaterial, crypto.randomBytes(892 - certificateMaterial.length)]).toString('base64'),
		];

		return {
			proofs: [
				{
					version: 1,
					useCase: 1,
					signature,
					certificateChain,
				},
			],
		};
	}

	static newLayout(name, data, extra = {}) {
		return {
			...extra,
			view_model: {
				[Array.isArray(data) ? 'primitives' : 'primitive']: data,
				__typename: `GenAI${name}LayoutViewModel`,
			},
		};
	}

	_makeNode(id, section, submessage) {
		return { id: id ?? null, section: section ?? null, submessage: submessage ?? null };
	}

	_registerId(node, id) {
		if (id === undefined || id === null || id === '') return;

		if (typeof id !== 'string') {
			throw new ContentValidationError('Item id must be a string', { id });
		}

		if (this._idIndex.has(id)) {
			throw new DuplicateIdError(id);
		}

		node.id = id;
		this._idIndex.set(id, node);
	}

	_unregisterId(node) {
		if (node.id && this._idIndex.get(node.id) === node) {
			this._idIndex.delete(node.id);
		}
	}

	hasId(id) {
		return typeof id === 'string' && this._idIndex.has(id);
	}

	getIds() {
		return [...this._idIndex.keys()];
	}

	peek(id) {
		const node = this._idIndex.get(id);

		if (!node) return null;

		return {
			id: node.id,
			section: node.section,
			submessage: node.submessage,
		};
	}

	assignId(index, id) {
		if (!Number.isInteger(index) || index < 0 || index >= this._nodes.length) {
			throw new InvalidTargetError(`Node index ${index} is out of range (0-${this._nodes.length - 1})`, { index });
		}

		const node = this._nodes[index];

		if (node.id) {
			throw new AIRichError(`Node at index ${index} already has id "${node.id}"`, 'ALREADY_HAS_ID', { index, id: node.id });
		}

		this._registerId(node, id);

		return this;
	}

	_getNode(id) {
		if (typeof id !== 'string' || !id) {
			throw new ContentValidationError('Item id must be a non-empty string', { id });
		}

		const node = this._idIndex.get(id);

		if (!node) {
			throw new ItemNotFoundError(id, this.getIds());
		}

		return node;
	}

	_resolveTarget(target) {
		if (Array.isArray(target)) {
			if (target.length < 1 || target.length > 2) {
				throw new ContentValidationError('Target must be id or [id, offset]', { target });
			}

			const [id, offset = 0] = target;

			if (typeof id !== 'string' || !id) {
				throw new ContentValidationError('Target id must be a non-empty string', { target });
			}

			if (!Number.isInteger(offset)) {
				throw new ContentValidationError('Offset must be an integer', { target });
			}

			return { id, offset };
		}

		if (typeof target !== 'string' || !target) {
			throw new ContentValidationError('Target must be a non-empty id or [id, offset]', { target });
		}

		return { id: target, offset: 0 };
	}

	_resolveNodeIndex(target) {
		const { id, offset } = this._resolveTarget(target);
		const node = this._getNode(id);
		const baseIndex = this._nodes.indexOf(node);

		if (baseIndex === -1) {
			throw new InvalidTargetError(`Item id "${id}" is registered but not present in the node list (internal desync)`, { id });
		}

		const index = baseIndex + offset;

		if (index < 0 || index >= this._nodes.length) {
			throw new InvalidTargetError(`Target "${id}" with offset ${offset} resolves to index ${index}, which is out of range (0-${this._nodes.length - 1})`, { id, offset, index });
		}

		return { id, offset, baseIndex, index };
	}

	_validateSections(section) {
		const items = Array.isArray(section) ? section : [section];

		if (!items.length) {
			throw new ContentValidationError('At least one section is required');
		}

		for (const item of items) {
			if (!item || typeof item !== 'object' || Array.isArray(item)) {
				throw new ContentValidationError('Sections must be plain objects');
			}
		}

		return items;
	}

	_validateSubmessages(submessage) {
		if (submessage === undefined || submessage === null) {
			return [];
		}

		const items = Array.isArray(submessage) ? submessage : [submessage];

		for (const item of items) {
			if (!item || typeof item !== 'object' || Array.isArray(item)) {
				throw new ContentValidationError('Submessages must be plain objects');
			}
		}

		return items;
	}

	_pairSubmessages(sections, submessages) {
		const n = sections.length;
		const m = submessages.length;

		if (m === 0) return sections.map(() => null);
		if (m === 1) return sections.map((_, i) => (i === 0 ? submessages[0] : null));
		if (m === n) return submessages;

		throw new ContentValidationError(`Cannot pair ${m} submessage(s) with ${n} section(s): expected 0, 1, or ${n}`, { sectionCount: n, submessageCount: m });
	}

	_addContent(section, submessage, { id, replace, insertAt } = {}) {
		const hasReplace = replace !== undefined && replace !== null && replace !== '';

		const hasInsertAt = insertAt !== undefined && insertAt !== null && insertAt !== '';

		if (hasReplace && hasInsertAt) {
			throw new ContentValidationError('replace and insertAt cannot be used together');
		}

		const sections = this._validateSections(section);
		const submessages = this._validateSubmessages(submessage);

		if (!sections.length) {
			throw new ContentValidationError('At least one section is required');
		}

		if (id !== undefined && id !== null && id !== '' && sections.length !== 1) {
			throw new ContentValidationError('One id can only be assigned to one node', {
				id,
				sectionCount: sections.length,
			});
		}

		if (submessages.length && submessages.length !== sections.length && submessages.length !== 1) {
			throw new ContentValidationError('Section and submessage count must match');
		}

		const pairedSubmessages = sections.map((_, index) => {
			if (!submessages.length) return undefined;

			return submessages.length === 1 ? submessages[0] : submessages[index];
		});

		if (id && this._idIndex.has(id) && !(hasReplace && this._resolveTarget(replace)?.id === id)) {
			throw new DuplicateIdError(id);
		}

		const newNodes = sections.map((currentSection, index) => {
			return this._makeNode(index === 0 ? id : null, currentSection, pairedSubmessages[index]);
		});

		if (hasReplace) {
			if (newNodes.length !== 1) {
				throw new ContentValidationError('replace only supports adding exactly one node');
			}

			const target = this._resolveNodeIndex(replace);

			if (!target) {
				throw new ContentValidationError('Target node could not be resolved');
			}

			const oldNode = this._nodes[target.index];
			const newNode = newNodes[0];

			if (!newNode.id && oldNode?.id) {
				newNode.id = oldNode.id;
			}

			this._unregisterId(oldNode);

			this._nodes.splice(target.index, 1, newNode);

			if (newNode.id) {
				this._idIndex.set(newNode.id, newNode);
			}

			return this;
		}

		if (hasInsertAt) {
			const target = this._resolveNodeIndex(insertAt);

			if (!target) {
				throw new ContentValidationError('Target node could not be resolved');
			}

			const insertIndex = target.offset < 0 ? target.index : target.index + 1;

			this._nodes.splice(insertIndex, 0, ...newNodes);

			for (const node of newNodes) {
				if (node.id) {
					this._idIndex.set(node.id, node);
				}
			}

			return this;
		}

		this._nodes.push(...newNodes);

		for (const node of newNodes) {
			if (node.id) {
				this._idIndex.set(node.id, node);
			}
		}

		return this;
	}

	addSection(section, options = {}) {
		return this._addContent(section, undefined, options);
	}

	addSubmessage(submessage, options = {}) {
		const items = this._validateSubmessages(submessage);

		if (!items.length) {
			throw new ContentValidationError('At least one submessage is required');
		}

		return this._addContent(undefined, items, options);
	}

	delete(target) {
		const { index } = this._resolveNodeIndex(target);
		const [oldNode] = this._nodes.splice(index, 1);

		this._unregisterId(oldNode);

		return this;
	}

	get _sections() {
		return this._nodes.filter((n) => n.section !== null).map((n) => n.section);
	}

	get _submessages() {
		return this._nodes.filter((n) => n.submessage !== null).map((n) => n.submessage);
	}

	get sections() {
		return this._sections;
	}

	get items() {
		return this._sections.flatMap((section) => {
			const vm = section?.view_model;

			if (Array.isArray(vm?.primitives)) {
				return vm.primitives;
			}

			if (vm?.primitive) {
				return [vm.primitive];
			}

			return [];
		});
	}
}

class ORich extends AIRich {}

module.exports = { VERSION, Button, ButtonV2, Carousel, AIRich, ORich, Toolkit, BaseBuilder, AIRichError, ItemNotFoundError, DuplicateIdError, InvalidTargetError, ContentValidationError };
