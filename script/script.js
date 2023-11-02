"use strict";

function debugList(arr) {
	for (let i = 0; i < arr.length; i++) {
		console.debug(arr[i]);
	}
}

/** Example: Returns "iphone-15-pro" for a site URL of https://www.apple.com/de/iphone-15-pro/?queries=and#hashes */
function getPagePath() {
	let pathParts = (new URL(window.location.href)).pathname.split("/");
	return pathParts.pop() || pathParts.pop();
}

/*
	# known url maps so far:
	- iPhone 15:
	{
		"color": {
			"DarkBlue": "blue_titanium_5G",
			"DarkTi": "black_titanium_5G",
			"LightTi": "white_titanium_5G",
			"TiGray": "natural_titanium_5G"
		},
		"size": {
			"base": "iphone_15_pro_max_iphone_15_pro",
			"small": "iphone_15_pro",
			"large": "iphone_15_pro_max"
		}
	}

	- M3 MacBook Pro:
	{
		"small": {
			"Dark": {
				"model": "macbook_pro_m3_pro_14_space_black.usdz",
				"acaClick": "prop3:view space black macbook pro 14 in your space",
				"acaTitle": "view space black macbook pro 14 in your space",
				"ariaLabel": "View in your space, Macbook Pro 14 inches in Space Black"
			},
			"Light": {
				"model": "macbook_pro_m3_pro_14_silver.usdz",
				"acaClick": "prop3:view silver macbook pro 14 in your space",
				"acaTitle": "view silver macbook pro 14 in your space",
				"ariaLabel": "View in your space, Macbook Pro 14 inches in Silver"
			}
		},
		"large": {
			"Dark": {
				"model": "macbook_pro_m3_pro_16_space_black.usdz",
				"acaClick": "prop3:view space black macbook pro 16 in your space",
				"acaTitle": "view space black macbook pro 16 in your space",
				"ariaLabel": "View in your space, Macbook Pro 16 inches in Space Black"
			},
			"Light": {
				"model": "macbook_pro_m3_pro_16_silver.usdz",
				"acaClick": "prop3:view silver macbook pro 16 in your space",
				"acaTitle": "view silver macbook pro 16 in your space",
				"ariaLabel": "View in your space, Macbook Pro 16 inches in Silver"
			}
		}
	}
*/
function parseURLOptionMap(dataset, urlOrigin) {
	let urls = [];
	let topObj = JSON.parse(dataset.urlOptionMap);

	if (["color", "size"].every((key) => (key in topObj))) {
		// iPhone 15 (Pro)
		for (const colorKey of Object.keys(topObj.color)) {
			let color = topObj.color[colorKey];
			for (const sizeKey of Object.keys(topObj.size)) {
				let size = topObj.size[sizeKey];
				urls.push(`${urlOrigin}${dataset.urlRoot}/${dataset.urlProduct}/${size}_${color}.usdz`);
			}
		}
	} else if (["small", "large"].every((key) => (key in topObj))) {
		// M3 MacBook Pro
		for (const sizeKey of Object.keys(topObj)) {
			let sizeObj = topObj[sizeKey];
			for (const colorKey of Object.keys(sizeObj)) {
				let colorObj = sizeObj[colorKey];
				let model = colorObj.model;
				urls.push(`${urlOrigin}${dataset.urlRoot}/${dataset.urlProduct}/${model}`);
			}
		}
	} else {
		throw new Error("Unsupported option map structure");
	}

	return urls;
}

function getAppleARLinks() {
	let urlOrigin = (new URL(window.location.href)).origin;
	console.debug("site host:", urlOrigin);

	// step 1: finding all <a> elements with rel=ar set
	console.debug("Step 1: a[rel=ar]");
	let dataUrlAttributes = ["urlRoot", "urlProduct", "urlOptionMap"];
	let arURLs = Array.from(document.querySelectorAll("a[rel=ar]")).flatMap(e => {
		if (dataUrlAttributes.every((attr) => (attr in e.dataset))) {
			let urls = [];
			try {
				let newURLs = parseURLOptionMap(e.dataset, urlOrigin);
				urls = urls.concat(newURLs);
			} catch(err) {
				console.error(err);
				throw err;
			}

			return urls;
		} else {
			let value = e.href; // expected to be absolute link
			if (value)
				return value;
		}
	});

	// step 2: finding other elements that might hold URLs to AR files
	console.debug("Step 2: attributes");
	let arAttributes = [
		"data-quicklook-url",
		"data-quicklook-classic-url",
		"data-quicklook-modern-url",
		"data-quicklook-classic-url-pro-max",
		"data-quicklook-modern-url-pro-max",
		"data-quicklook-classic-url-mini",
		"data-quicklook-modern-url-mini",
		"data-quicklook-udz",
		"data-quicklook-udz-promax",
		"data-quicklook-udz-mini",
		"data-ar-quicklook-usdz"
	];
	let arQuerySelectors = arAttributes.map(s => `[${s}]`).join(",");
	let arRelatedElements = document.querySelectorAll(arQuerySelectors);

	for (let i = 0; i < arRelatedElements.length; i++) {
		let e = arRelatedElements[i];

		for (let j = 0; j < arAttributes.length; j++) {
			let attr = arAttributes[j];
			let value = e.getAttribute(attr);
			if (value)
				arURLs.push(value);
		}
	}

	// step 2.5: the data-ar-quicklook-attribs-by-model attribute might contain JSON containing more filenames
	console.debug("Step 2.5: more attributes");
	let arAttribsElements = document.querySelectorAll("[data-ar-quicklook-attribs-by-model]");
	for (let i = 0; i < arAttribsElements.length; i++) {
		let e = arAttribsElements[i];
		let valueJSON = e.getAttribute("data-ar-quicklook-attribs-by-model");
		if (!valueJSON)
			continue;

		console.debug(valueJSON);

		try {
			let topObj = JSON.parse(valueJSON);
			for (let deviceKey in topObj) {
				let deviceObj = topObj[deviceKey];
				if (!deviceObj.hasOwnProperty("data-ar-quicklook-usdz"))
					continue;

				arURLs.push(deviceObj["data-ar-quicklook-usdz"]);
			}
		} catch(err) {
			console.error(err);
			throw new Error("Couldn't parse data-ar-quicklook-attribs-by-model structure.");
		}
	}

	// step 3 (ONLY if no files have been found): apply regex to body.innerHTML
	if (arURLs.length === 0) {
		console.debug("Step 3: regex");

		let arFallbackRegex = /\"([a-z0-9\/\-_\.]+?\.(?:usdz|reality))\"/gmi;
		let allMatches = [...document.body.innerHTML.matchAll(arFallbackRegex)].map(m => m[1]);

		arURLs = arURLs.concat(allMatches);
	}

	// cleanup: make every relative URL absolute
	let absURLs = [];
	for (const url of arURLs) {
		if (url == null)
			continue;

		if (url.startsWith("http")) {
			absURLs.push(url);
			continue; // url is already absolute
		}

		let newURL = new URL(url, urlOrigin);
		absURLs.push(newURL.href);
	}

	absURLs = [...new Set(absURLs)].sort();
	debugList(absURLs);
	return absURLs;
}

function returnValue() {
	let links = null;
	let error = null;

	try {
		links = getAppleARLinks();
	} catch(err) {
		error = err;
	}

	return {
		urls: links,
		error: error,
		path: getPagePath()
	};
}

returnValue();