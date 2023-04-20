const uniq = array => array.filter((a, index) => array.indexOf(a) === index);
const {intersecDetails} = require('object-tracking-measure');
const {firstAndLastNonNull} = require('object-tracking-measure');
const {fastGetNullSegment} = require('object-tracking-measure');
const {allNonNull} = require('object-tracking-measure');

const {KalmanFilter} = require('kalman-filter');

const getIndexesByIntersection = function (indexes1, indexes2) {
	const {
		intersec,
		nonIntersec
	} = intersecDetails(indexes1, indexes2);

	if (nonIntersec[0].length === 0 && nonIntersec[1].length === 0) {
		// Full intersection
		return intersec.sort((a, b) => a - b);
	}

	// Flatten and sort the non intersecting times
	const nonIntersecAll = nonIntersec.map((time, source) => {
		return time.map(value => ({value, source}));
	})
		.reduce((a, b) => a.concat(b))
		.sort((a, b) => a.value - b.value);

	// List segments by source
	const result = [nonIntersecAll[0].value];

	for (let i = 1; i < nonIntersecAll.length - 1; i++) {
		if (nonIntersecAll[i].source !== nonIntersecAll[i - 1].source || nonIntersecAll[i].source !== nonIntersecAll[i + 1].source) {
			result.push(nonIntersecAll[i].value);
		}
	}

	result.push(nonIntersecAll[nonIntersecAll.length - 1].value);
	const out = uniq(result.concat(intersec).sort((a, b) => a - b));
	if (indexes1.length === 3 && indexes2.length === 31) {
		console.log('sq-forward-mahalanobis-track l.42', out.length);
	}

	return out;
};

//
// this._weightedAppearanceVector = [
// 	this._weightedAppearanceVector,
// 	appearance.toWeighted(checkpoint.detectBox[this.appearanceKey], checkpoint.detectBox.box)
// ].reduce(appearance.wSum.bind(this, gallerySize));

const getComparisonIndexes = function ({tracks, cacheKey}) {
	if (tracks.length !== 2) {
		throw (new Error('getComparisonIndexes only taskes 2 tracks'));
	}

	const firsts = [];
	const lasts = [];
	tracks.forEach(track => {
		const {first, last} = firstAndLastNonNull(track.map(t2 => (t2 && t2[cacheKey]) ? t2[cacheKey] : null));
		firsts.push(first);
		lasts.push(last);
	});
	const first = Math.max(...firsts);
	const last = Math.min(...lasts);
	if (last === -1) {
		throw (new Error(`Empty track for ${cacheKey}`));
	}

	if (first > last) {
		// We cannot use middleTime cause in the forward kalmanMode, the backward interpolation is not possible
		// then bigger will have no significant value in middleTime
		const first2 = Math.max(...firsts);
		return [first2];
	}

	const allIndexes = tracks.map(t => allNonNull({track: t.map(t2 => (t2 && t2[cacheKey]) ? t2[cacheKey] : null), start: first, end: last}));

	for (let a = 0; a < allIndexes.length; a++) {
		// The track is jumping over the intersection time
		// we return the other's track
		if (allIndexes[a].length === 0) {
			const other = allIndexes[1 - a];
			const results = uniq([other[0], other[other.length - 1]]);
			return results;
		}
	}

	return getIndexesByIntersection(allIndexes[0], allIndexes[1]);
};

const track2trackDist = function ({tracks, cacheKey, kf, getTime, obsIndexes, predict}) {
	if (tracks.length !== 2) {
		throw (new Error('track2trackDist only taskes 2 tracks'));
	}

	const indexes = getComparisonIndexes({tracks, getTime, cacheKey});
	if (indexes.length === 0) {
		throw (new Error('getComparisonIndexes has no indexes'));
	}

	if (indexes.filter(a => Number.isNaN(a)).length > 0) {
		throw (new Error('indexes has NaNs'));
	}

	const distsByIndexes = indexes.map(i => {
		const states = tracks.map(track => {
			if (track[i] !== null && track[i][cacheKey] !== null) {
				if (typeof (track[i]) === 'undefined') {
					throw (new TypeError('undefined track'));
				}

				return track[i][cacheKey];
			}

			const lastPreviousIndex = fastGetNullSegment({
				track: track.map(t2 => (t2 && t2[cacheKey]) ? t2[cacheKey] : null),
				iteration: i
			}).first - 1;

			if (lastPreviousIndex < 0 || track[lastPreviousIndex] === null || (track[lastPreviousIndex + 1] !== null && track[lastPreviousIndex + 1][cacheKey] !== null)) {
				throw (new Error('lastPreviousIndex is corrupted'));
			}

			const previousCorrected = track[lastPreviousIndex][cacheKey];
			if (!previousCorrected) {
				console.log(cacheKey, i, indexes);
				throw (new Error('previous Corrected mus be defined'));
			}

			const predicted = predict({previousCorrected, getTime, index: i});
			return predicted;
		});
		return states[0].obsBhattacharyya({kf, state: states[1], obsIndexes});
	});

	const squareSumAv = distsByIndexes.reduce((a, b) => a + b) / indexes.length;

	return squareSumAv;
};

module.exports = function (options) {
	const {kalmanFilterArgs, cacheKey = 'state', getTime, bhattacharyyaObsIndexes} = options;
	const kf = new KalmanFilter(kalmanFilterArgs);
	const predict = kf.predict.bind(kf);

	return {
		mapTrack: track => {
			return track;
		},
		cacheKey,
		fn: (t1, t2, options) => {
			return track2trackDist({tracks: [t1, t2], cacheKey, kf, getTime, obsIndexes: bhattacharyyaObsIndexes, predict, debug: options.debug});
		}
	};
};
