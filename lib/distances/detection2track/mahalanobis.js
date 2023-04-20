const {KalmanFilter, State} = require('kalman-filter');

const listRules = function ({exclusiveObsIndexes, nonNullIndexes}) {
	// When stateProjection is not invertible detailedMahalanobis is not working with all the observation
	// we then split the distance into multuiple calculations
	// and we do the average
	let exclusionRules = [];
	if (exclusiveObsIndexes) {
		const rules = exclusiveObsIndexes.filter(indexes => indexes.every(i => nonNullIndexes.includes(i)));
		if (rules.length > 0) {
			let groups = [[]];
			rules.forEach(r => {
				groups = r.map(current => {
					return groups.map(g => {
						return g.concat(current);
					});
				}).reduce((a, b) => a.concat(b));
			});
			exclusionRules = groups;
		}
	}

	return exclusionRules;
};

const huge = 1e10;

/**
* Transform a state object into a State instance
* only if needed
* @param {State|Object|null} state
* @returns {State}
*/
const safeState = function (state) {
	if (!state) {
		return state;
	}

	if (state instanceof State) {
		return state;
	}

	if (state instanceof Object) {
		return new State(state);
	}

	throw (new Error('invalid state'));
};

module.exports = function ({
	kalmanFilterArgs,
	exclusiveObsIndexes,
	obsIndexes,
	cacheKey = 'state',
	getTime,
	observationKey = 'box',
	varianceKey = 'variance',
	nonNullNormalization = false
}) {
	if (typeof (kalmanFilterArgs) !== 'object') {
		throw (new TypeError('kalmanFilterArgs is mandatory'));
	}

	const kf = new KalmanFilter(kalmanFilterArgs);

	const mapTrack = ((track, trackIndex, lastNonNull) => {
		if (lastNonNull[cacheKey] === null) {
			const nonNullCache = track.filter(t => t && t[cacheKey] !== null);
			if (nonNullCache.length > 0) {
				return mapTrack(track, trackIndex, nonNullCache[nonNullCache.length - 1]);
			}

			return null;
		}

		const pred = kf.predict({
			previousCorrected: safeState(lastNonNull[cacheKey]),
			index: track.length,
			getTime
		});

		try {
			pred.check();
		} catch (error) {
			console.log(lastNonNull[cacheKey]);
			throw (error);
		}

		if (Number.isNaN(pred.mean[0][0])) {
			console.log(pred);
			console.log(pred.check());
			throw (new Error('invalid state'));
		}

		return pred;
	});

	return {
		mapTrack,
		mapDetection: detection => {
			if (typeof (detection) === 'undefined') {
				throw (new TypeError('detection isnot defined'));
			}

			// Console.log('mapDetection mahalanobis',{detection})

			return detection;
		},
		fn: (mappedTrack, mappedDetection) => {
			if (mappedTrack === null || typeof (mappedDetection[observationKey]) === 'undefined') {
				return huge;
			}

			const nonNullIndexes = mappedDetection[observationKey]
				.map((value, index) => ({value, index}))
				.filter(d => d.value !== null)
				.map(({index}) => index);

			const localObsIndexes = nonNullIndexes.filter(d => (!obsIndexes || obsIndexes.includes(d)));
			const exclusionRules = listRules({exclusiveObsIndexes, nonNullIndexes: localObsIndexes});

			let value;
			if (exclusionRules.length === 0) {
				value = mappedTrack.detailedMahalanobis({
					kf,
					observation: mappedDetection[observationKey],
					obsIndexes: localObsIndexes
				}).value;
			} else {
				value = exclusionRules.map(excludingObsIndexes => {
					const localNonNullIndexes = nonNullIndexes.filter(j => !excludingObsIndexes.includes(j));

					return mappedTrack.detailedMahalanobis({
						kf,
						observation: mappedDetection[observationKey],
						obsIndexes: localNonNullIndexes
					}).value;
				}).reduce((a, b) => a + b) / exclusionRules.length;
			}

			// If (result.value === 0.00028640849067241235){
			// 	console.log({mappedTrack: mappedTrack.mean, cov: mappedTrack.covariance, mappedDetection: mappedDetection.box8d, diff: result.diff, covarianceInvert : result.covarianceInvert, value: result.value})
			// }

			if (nonNullNormalization) {
				return value / localObsIndexes.length;
			}

			return value;
		},
		cacheKey,
		cache: ({mappedTrack, mappedDetection, index}) => {
			if (typeof (index) !== 'number') {
				throw (new TypeError('index should be a number'));
			}

			// Console.log('cache mahalanobis', mappedDetection, observationKey)
			const predicted = mappedTrack || kf.predict({getTime, index});
			// Console.log('mahalanobis track predicted is', predicted.mean)
			// console.log('mappedDetection[varianceKey]', mappedDetection[varianceKey])
			// console.log({mappedDetection, index})
			if (mappedDetection[varianceKey] && (mappedDetection[observationKey].length !== mappedDetection[varianceKey].length)) {
				throw (new Error(`variance (${mappedDetection[varianceKey].length}) and observation (${mappedDetection[observationKey].length}) should be the same size`));
			}

			if (typeof (mappedDetection[observationKey]) === 'undefined') {
				return null;
				// Throw (new Error(`cannot find ${observationKey} in ${JSON.stringify(mappedDetection)}`));
			}

			if (mappedDetection[observationKey][0] === null) {
				if (typeof (mappedDetection[varianceKey]) === 'undefined') {
					throw (new TypeError(`We expect to have ${varianceKey} when ${observationKey} is null`));
				}
			}

			const corrected = kf.correct({
				predicted,
				observation: mappedDetection[observationKey],
				variance: mappedDetection[varianceKey],
				getTime
			});

			return corrected;
		},
		kf
	};
};
