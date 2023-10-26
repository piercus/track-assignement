module.exports = function ({localMatched, localTrackIds, localDetectionIds}) {
	const matched = [];

	const matchedTrackIds = [];
	const matchedDetectionIds = [];
	localMatched.forEach(m => {
		const {trackId: localTrackId, detectionId: localDetectionId} = m;
		const trackId = localTrackIds[localTrackId];
		const detectionId = localDetectionIds[localDetectionId];

		matchedTrackIds.push(trackId);
		matchedDetectionIds.push(detectionId);

		matched.push(Object.assign({}, m, {
			trackId,
			detectionId
		}));
	});
	const unmatchedDetectionIds = localDetectionIds.filter(detectionId => !matchedDetectionIds.includes(detectionId));
	const unmatchedTrackIds = localTrackIds.filter(trackId => !matchedTrackIds.includes(trackId));

	return {
		matched,
		unmatchedDetectionIds,
		unmatchedTrackIds
	};
};
