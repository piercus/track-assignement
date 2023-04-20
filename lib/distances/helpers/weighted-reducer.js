module.exports = function(gallerySize, a, b) {
	const vectorA = a.vector;
	const vectorB = b.vector;
	const wA = a.weight;
	const wB = b.weight;

	if (typeof (gallerySize) !== 'number') {
		throw (new TypeError('gallery size must be a number'));
	}

	if (a.gallery.length > gallerySize || b.gallery.length > gallerySize) {
		throw (new Error(`should be smaller than gallerySize ${gallerySize}`));
	}

	if ((wA + wB) <= gallerySize) {
		return {
			vector: vectorA.map((a, index) => {
				return ((wA * a) + (wB * vectorB[index])) / (wA + wB);
			}),
			weight: wA + wB,
			gallery: a.gallery.concat(b.gallery)
		};
	}

	let gallery;
	if (wA >= gallerySize) {
		gallery = a.gallery.slice(0, gallerySize);
	} else {
		gallery = a.gallery.concat(b.gallery).slice(0, gallerySize);
	}

	return gallery.map(a => appearance.toWeighted(a)).reduce(appearance.wSum.bind(this, gallerySize));
};