const detection2track = require('../detection2track/appearance-euclidean-min');

//
// this._weightedAppearanceVector = [
// 	this._weightedAppearanceVector,
// 	appearance.toWeighted(checkpoint.detectBox[this.appearanceKey], checkpoint.detectBox.box)
// ].reduce(appearance.wSum.bind(this, gallerySize));

module.exports = function (options) {
	const detection2trackInst = detection2track(options);
	const cacheKey = detection2trackInst.cacheKey;
	return {
		mapTrack: detection2trackInst.mapTrack,
		cacheKey,
		fn: detection2trackInst.fn
	};
};
