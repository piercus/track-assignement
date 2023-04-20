const appearanceEuclidean = require('./appearance-euclidean');

//
// this._weightedAppearanceVector = [
// 	this._weightedAppearanceVector,
// 	appearance.toWeighted(checkpoint.detectBox[this.appearanceKey], checkpoint.detectBox.box)
// ].reduce(appearance.wSum.bind(this, gallerySize));

module.exports = function (options) {
	const genericAppearance = appearanceEuclidean(options);

	const recentAppearance = appearanceEuclidean(Object.assign({}, options, {gallerySize: options.gallerySizeRecent}));
	return {
		mapTrack: genericAppearance.mapTrack,
		mapDetection: genericAppearance.mapDetection,
		fn: (mappedTrack, mappedDetection) => {
			const gen = genericAppearance.fn(mappedTrack && mappedTrack.generic, mappedDetection);
			const recent = genericAppearance.fn(mappedTrack && mappedTrack.recent, mappedDetection);
			if (gen === null && recent === null) {
				return null;
			}

			if (gen === null || recent === null) {
				return gen || recent;
			}

			return Math.min(gen, recent);
		},
		cacheKey: genericAppearance.cacheKey,
		cache: ({mappedTrack, mappedDetection}) => {
			return {
				generic: genericAppearance.cache({
					mappedTrack: mappedTrack && mappedTrack.generic,
					mappedDetection
				}),
				recent: recentAppearance.cache({
					mappedTrack: mappedTrack && mappedTrack.recent,
					mappedDetection
				})
			};
		}
	};
};
