/**
* @typedef {Object} GetDistanceResponse
* @property {Boolean} threshold
* @property {Object.<String, Number>} values
*/

/**
* Optimized version of getDistances,
* computing the quickest distances first and comparing them to threshold then other distances
* in order to compute more heavy distances only if needed
* @param {Object.<String, Any>} a
* @param {Object.<String, Any>} b
* @param {Object} getDistancesOptions
* @param {Logger} getDistancesOptions.logger
* @param {Array.<String>} getDistancesOptions.order keys to get distance from, ordered from lighter computing to heavier computing
* @param {Array.<String>} getDistancesOptions.mandatoryKeys keys that are computed anyway,
* @param {DistanceValues} getDistancesOptions.thresholds
*/

module.exports = function (a, b, options) {
	const result = {};
	const {logger, order, mandatoryKeys = [], thresholds, distances, debugTime} = options;

	let threshold = true;
	let keepGoing = true;
	const timeSpent = {};
	order.forEach(k => {
		const startTime = new Date();

		if (keepGoing || mandatoryKeys.includes(k)) {
			const mappedA = a[k];
			const mappedB = b[k];
			const fn = distances[k].fn || distances[k];
			if (typeof (fn) !== 'function') {
				throw (new TypeError(`Cannot call distance.fn on ${k}`));
			}

			result[k] = fn(mappedA, mappedB, options);
			if (
				typeof (options.logMessage) === 'function'
			) {
				const message = options.logMessage(
					Object.assign({}, options, {result: result[k], threshold: thresholds[k], distanceName: k, mappedTrack: mappedA, mappedDetection: mappedB})
				);
				if (typeof (message) === 'string') {
					logger.info(message);
				}
			}

			if (thresholds && thresholds[k] <= result[k]) {
				threshold = false;
				keepGoing = false;
			}
		}

		timeSpent[k] = ((new Date()).getTime() - startTime.getTime());
		if (debugTime && (timeSpent[k] > debugTime)) {
			logger.debug(`Distance[${k}] took ${timeSpent[k]}`);
		}
	});
	return {
		threshold,
		thresholds,
		values: result,
		timeSpent
	};
};
