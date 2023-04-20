const {intersecDistance} = require('object-tracking-measure');
const {allNonNull} = require('object-tracking-measure');
const {firstAndLastNonNull} = require('object-tracking-measure');
const {fastGetNullSegment} = require('object-tracking-measure');

const ageDistance = function ({tracks, getTime}) {
	const firsts = [];
	const lasts = [];
	tracks.forEach(track => {
		const {first, last} = firstAndLastNonNull(track);
		firsts.push(first);
		lasts.push(last);
	});

	const first = Math.max(...firsts);
	const last = Math.min(...lasts);

	if (first > last) {
		return getTime(first) - getTime(last);
	}

	const allIndexes = tracks.map(t => allNonNull({track: t, start: first, end: last}));

	for (const [a, allIndex] of allIndexes.entries()) {
		// The track is jumping over the intersection time
		// we return the other's track
		if (allIndex.length === 0) {
			const segment = fastGetNullSegment({track: tracks[a], iteration: first});
			// Segment.type === null
			return Math.min(first - segment.first, segment.last - last);
		}
	}

	const result = intersecDistance({indexesFirst: allIndexes[0], indexesSecond: allIndexes[1], getTime});

	return result;
};

module.exports = function (options) {
	const getTime = options.getTime || (o => o);
	return {
		mapTrack: t => t,
		fn: (t1, t2) => ageDistance({tracks: [t1, t2], getTime})
	};
};
