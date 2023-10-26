const updateCache = require('./update-cache');
const {getStats: getTrackStats} = require('object-tracking-measure');
/**
* This algorithm is inspired from deepSort
*  Merge is done between tracks in differents steps
*  - init mergedTracks as []
*  - group the tracks by starting time blocks
*  - for each group G
	*  + Sort tracks by number of tracks subgroup S
	*  + For each group S
		*  + Create a gate matrix (trajectory/tracks-subgroup) using : exclusion table (double detection), spatial proximity, appearanceThreshold
		*  + remove mergedTracks/tracks with 0-matrix gate
		*  + Create a distance matrix (trajectory/tracks-subgroup) using appearance
		*  + match the tracks-subgroup/mergedTracks using hungarianAlgorithm
		*  + merge matching tracks into mergedTracks
		*  + create new trajectory from unmatching tracks
*  (D) repeat (C) for each cam
*  (E) Remove small/outside mergedTracks
*
* @param {Array.<Track>} tracks to merge together
* @param {DistanceValues} thresholds
* @param {DistanceValues} lambdas
* @returns {Array.<Track>}
* */
module.exports = function ({
	tracks,
	thresholds,
	lambdas,
	mappedTracks = [],
	distances,
	mergeTracks,
	order = ['exclusion', 'appearance', 'spatial'],
	logger = console
}) {
	const initLength = tracks.length;
	const inactiveTracks = [];
	let distTriangMatrix = tracks.map(() => []);
	let keepOnGoing = true;
	let mergeId = 0;

	order.forEach(k => {
		if (typeof (distances[k]) !== 'object') {
			throw (new TypeError(`distances[${k}] is not defined should be in ${Object.keys(distances)}`));
		}

		if (typeof (distances[k].mapTrack) !== 'function') {
			throw (new TypeError(`distances[${k}].mapTrack is not a function`));
		}
	});
	logger.debug(`Merge Tracks ${tracks.map((t, id) => id + ':' + getTrackStats({track: t}).count).join(', ')}`);

	while (keepOnGoing && tracks.length > 1) {
		// DebugList = [];

		const cache = updateCache({tracks, mappedTracks, distMatrix: distTriangMatrix, logger, order, thresholds, distances, lambdas});
		mappedTracks = cache.mappedTracks;
		distTriangMatrix = cache.distMatrix;

		const allDistancesWithIndexes = distTriangMatrix
			.map((row, rowIndex) =>
				row
					.map((c, colIndex) => ({colIndex, rowIndex, distance: c.distance, threshold: c.threshold, distances: c.distances}))
					.filter(({threshold}) => threshold)
			)
			.reduce((a, b) => a.concat(b));

		if (allDistancesWithIndexes.length === 0) {
			keepOnGoing = false;
		} else {
			// Kind of argmin
			const {colIndex, rowIndex} = allDistancesWithIndexes.reduce((a, b) => (a.distance < b.distance ? a : b));
			// Console.log(`${mergeId} Merge Tracks ${rowIndex}[${getTrackStats({track: tracks[rowIndex]}).count}] <-> ${colIndex}[${getTrackStats({track: tracks[colIndex]}).count}], with distance = ${distance}, threshold = ${threshold}`);
			// console.log(`${mergeId} Merge Tracks`, distances);
			const {track: newTrack, inactiveTracks: localInactiveTracks} = mergeTracks({tracks: [tracks[rowIndex], tracks[colIndex]], mergeId});

			delete distTriangMatrix[colIndex];
			delete distTriangMatrix[rowIndex];

			distTriangMatrix.forEach(row => {
				delete row[colIndex];
				delete row[rowIndex];
				row.splice(colIndex, 1);
			});

			delete mappedTracks[colIndex];
			delete mappedTracks[rowIndex];

			tracks[rowIndex] = newTrack;

			tracks.splice(colIndex, 1);
			mappedTracks.splice(colIndex, 1);
			distTriangMatrix.splice(colIndex, 1);
			inactiveTracks.push(...localInactiveTracks);
			mergeId++;
		}
	}

	logger.debug(`Dedup tracks : ${initLength} -> ${tracks.length}, ${inactiveTracks.length} inactives`);
	// Console.log('debugList', JSON.stringify(debugList, null, 4));
	return {tracks, inactiveTracks};
};
