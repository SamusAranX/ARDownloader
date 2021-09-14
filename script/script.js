function relToAbs(url){
	if(/^(https?):/i.test(url))
		return url; // url is already absolute

	var base_url = location.href.match(/^(.+)\/?(?:#.+)?$/)[0]+"/";
	if(url.substring(0,2) == "//")
		return location.protocol + url;
	else if(url.charAt(0) == "/")
		return location.protocol + "//" + location.host + url;
	else if(url.substring(0,2) == "./")
		url = "." + url;
	else if(/^\s*$/.test(url))
		return ""; // Empty = Return nothing
	else
		url = "../" + url;

	url = base_url + url;
	var i=0
	while(/\/\.\.\//.test(url = url.replace(/[^\/]+\/+\.\.\//g,"")));

	/* Escape certain characters to prevent XSS */
	url = url.replace(/\.$/,"").replace(/\/\./g,"").replace(/"/g,"%22")
					.replace(/'/g,"%27").replace(/</g,"%3C").replace(/>/g,"%3E");
	return url;
}

function getAppleARLinks() {
	let arURLs = [];

	// step 1: finding all <a> elements with rel=ar set
	arURLs = Array.from(document.querySelectorAll("a[rel=ar]")).map(e => {
		let value = e.href;
		if (value)
			return value;

		return null;
	});

	// step 2: finding other elements that might hold URLs to AR files
	let arAttributes = [
		"data-quicklook-classic-url",
		"data-quicklook-modern-url",
		"data-quicklook-classic-url-pro-max",
		"data-quicklook-modern-url-pro-max",
		"data-quicklook-classic-url-mini",
		"data-quicklook-modern-url-mini",
	];
	let arQuerySelectors = arAttributes.map(s => `[${s}]`).join(",");
	let arRelatedElements = document.querySelectorAll(arQuerySelectors);

	for (var i = 0; i < arRelatedElements.length; i++) {
		let e = arRelatedElements[i];

		for (var j = 0; j < arAttributes.length; j++) {
			let attr = arAttributes[j];
			value = e.getAttribute(attr);
			if (value)
				arURLs.push(value);
		}
	}

	if (!arURLs) {
		// step 3 (ONLY if no files have been found): apply regex to body.innerHTML
		let arFallbackRegex = /\"([a-z0-9\/\-_\.]+?\.(?:usdz|reality))\"/gmi;
		let allMatches = [...document.body.innerHTML.matchAll(arFallbackRegex)].map(m => m[1]);

		arURLs = arURLs.concat(allMatches);
	}

	// return deduplicated and filtered list
	return [...new Set(arURLs.filter(x => x).map(relToAbs))];
}

function getPagePath() {
	let parts = window.location.href.split('/');
	let lastPart = parts.pop() || parts.pop();
	return lastPart.split('#')[0].split('?')[0];
}

function returnValue() {
	return {
		urls: getAppleARLinks(),
		path: getPagePath()
	}
}

returnValue();