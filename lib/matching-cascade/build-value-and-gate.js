const {mapMatrix} = require('simple-linalg');
const getDistances = require('./get-distances');
const {lastNonNull: getLastNonNull} = require('object-tracking-measure');
const lambdaSumDistances = require('./lambda-sum-distances');
const applyMap = require('./apply-map');
/**
* @typedef {Object} ValueAndGate
* @property {Matrix.<Boolean>} threshold
* @property {Matrix.<Number>} value
* @property {Matrix.<GetDistanceResponse>} details
* @property {Array.<Object.<DistanceKey, Any>>} mappedTracks same length as tracks
* @property {Array.<Object.<DistanceKey, Any>>} mappedDetections same length as detections
*/

/**
* @param {DistancesMapDefinition} distances
* @param {Array.<Any>} tracks
* @param {Array.<Any>} detections
* @param {Object.<DistanceKey, Number>} lambdas
* @param {Object.<DistanceKey, Number>} thresholds
* @param {Array.<DistanceKey>} order
* @returns {ValueAndGate}
*/

module.exports = function ({
	distances,
	tracks,
	detections,
	logger,
	thresholds,
	order,
	lambdas,
	logMessage,
	context
}) {
	const cacheTrack = [];
	// Const startTime = new Date();

	let mandatoryKeys = [];
	if (thresholds) {
		mandatoryKeys = Object.keys(thresholds).filter(k => thresholds[k] > 0);
	}

	tracks.forEach((o, trackIndex) => {
		const {value: lastNonNull, index: lastNonNullIndex} = getLastNonNull(o);
		cacheTrack.push(applyMap([o, trackIndex, lastNonNull, lastNonNullIndex], {distances, order, fnName: 'mapTrack'}));
	});

	const cacheDetection = [];

	detections.forEach(o => {
		cacheDetection.push(applyMap([o], {distances, order, fnName: 'mapDetection'}));
	});
	const details = cacheTrack.map((r, trackLocalIndex) => cacheDetection.map((d, detectionLocalIndex) => getDistances(r, d, {
		logger,
		order,
		mandatoryKeys,
		thresholds,
		distances,
		debugTime: 50,
		logMessage,
		context: Object.assign({}, context, {trackLocalIndex, detectionLocalIndex, track: tracks[trackLocalIndex], detection: detections[detectionLocalIndex]})
	})));
	const value = mapMatrix(details, array => {
		const result = lambdaSumDistances({
			keys: mandatoryKeys,
			values: array.values,
			lambdas
		});
		array.value = result;
		return result;
	});

	// If (Number.isNaN(value[0][0])) {
	// 	throw (new TypeError('value should not be NaN'));
	// }

	return {
		gate: mapMatrix(details, a => a.threshold),
		value,
		details,
		mappedTracks: cacheTrack,
		mappedDetections: cacheDetection
	};
};
