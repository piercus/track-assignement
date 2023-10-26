const translateMatchIds = require('./translate-match-ids');

module.exports = function ({tracks, detections, context, matchingStages}) {
	let matched = [];
	let unmatchedDetectionIds = detections.map((value, detectionId) => detectionId);
	let unmatchedTrackIds = tracks.map((value, trackId) => trackId);
	const results = [];

	matchingStages.forEach((matchingStage, stageIndex) => {
		// If no tracks to match after a stage, stop
		if (unmatchedTrackIds.length === 0) {
			return;
		}

		// Stocks mappedTracks and localAgeMappedDetections

		const result = matchingStage.match({
			tracks: unmatchedTrackIds.map(trackId => tracks[trackId]),
			context: Object.assign({}, context, {stageIndex}),
			detections: unmatchedDetectionIds.map(detectionId => detections[detectionId])
		});

		const {matched: localMatched} = result;

		const {
			matched: newMatched,
			unmatchedDetectionIds: newUnmatchedDetectionIds,
			unmatchedTrackIds: newUnmatchedTrackIds
		} = translateMatchIds({
			localMatched,
			localTrackIds: unmatchedTrackIds,
			localDetectionIds: unmatchedDetectionIds
		});

		matched = matched.concat(newMatched.map(m => Object.assign({stageIndex}, m)));
		unmatchedDetectionIds = newUnmatchedDetectionIds;
		unmatchedTrackIds = newUnmatchedTrackIds;
		results.push(result);
	});

	const {mappedTracks, mappedDetections} = results[0];

	// Check that all tracks have been mapped
	if (mappedTracks.length !== tracks.length) {
		throw (new Error('Invalid mappedTracks length'));
	}

	return Object.assign({}, {mappedTracks, mappedDetections}, {unmatchedDetectionIds, unmatchedTrackIds, matched});
};
