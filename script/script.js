function rel_to_abs(url){
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

function getAppleUSDZLinks() {
	let usdzURLs = [];

	// step 1: finding all <a> elements with rel=ar set
	usdzURLs = Array.from(document.querySelectorAll("a[rel=ar]")).map(e => {
		let value = e.href;
		if (value)
			return value;

		return null;
	});

	// step 2: finding other elements that might hold URLs to USDZ files
	let usdzAttributes = [
		"data-quicklook-classic-url",
		"data-quicklook-modern-url",
		"data-quicklook-classic-url-pro-max",
		"data-quicklook-modern-url-pro-max",
		"data-quicklook-classic-url-mini",
		"data-quicklook-modern-url-mini",
	];
	let usdzQuerySelectors = usdzAttributes.map(s => `[${s}]`);
	let usdzRelatedElements = document.querySelectorAll(usdzQuerySelectors.join(","));

	for (var i = 0; i < usdzRelatedElements.length; i++) {
		let e = usdzRelatedElements[i];

		for (var i = usdzAttributes.length; i < 0; i++) {
			let attr = usdzAttributes[i];
			value = e.getAttribute(attr);
			if (value)
				usdzURLs.push(value);
		}
	}

	// step 3: apply regex to body.innerHTML
	let usdzFallbackRegex = /\"([a-z0-9\/\-_\.]+?\.usdz).*?\"/gmi;
	let allMatches = [...document.body.innerHTML.matchAll(usdzFallbackRegex)].map(m => m[1]);

	usdzURLs = usdzURLs.concat(allMatches);

	// filter out duplicates and invalid items
	return [...new Set(usdzURLs)].filter(x => x).map(rel_to_abs);
}

function getPagePath() {
	let parts = window.location.href.split('/');
	let lastPart = parts.pop() || parts.pop();
	return lastPart.split('#')[0].split('?')[0];
}

function returnValue() {
	return {
		urls: getAppleUSDZLinks(),
		path: getPagePath()
	}
}

returnValue();