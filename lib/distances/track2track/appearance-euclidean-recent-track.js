const detection2track = require('../detection2track/appearance-euclidean');

//
// this._weightedAppearanceVector = [
// 	this._weightedAppearanceVector,
// 	appearance.toWeighted(checkpoint.detectBox[this.appearanceKey], checkpoint.detectBox.box)
// ].reduce(appearance.wSum.bind(this, gallerySize));

module.exports = function (options) {
	const detection2trackInst = detection2track(options);
	const cacheKey = detection2trackInst.cacheKey;
	return {
		mapTrack(...args) {
			const cache1 = detection2trackInst.mapTrack(...args);
			if (typeof (cache1.generic) === 'undefined') {
				throw (new TypeError('Cache key doe snot conatins any recent/geenric structure'));
			}

			return cache1.generic;
		},
		cacheKey,
		fn: detection2trackInst.fn
	};
};
