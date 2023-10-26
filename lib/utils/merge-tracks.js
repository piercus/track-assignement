module.exports = function ({tracks, tracker, trackItemToDetection, forceMatch = false}) {
	if (tracks.length !== 2) {
		throw (new Error('should have exactly 2 tracks'));
	}

	const inactiveTracks = [];

	const [t1, t2] = tracks;
	let newTrack = null;
	t1.forEach((t, index) => {
		const detections = [t1[index], t2[index]].filter(a => a !== null).map(o => trackItemToDetection(o));
		if (detections.length > 1 && forceMatch) {
			throw (new Error('forceMatch cannot be used to merge tracks with overlapping detections'));
		}

		if (detections.length > 0 || newTrack !== null) {
			let iterationTracks;
			if (newTrack === null) {
				iterationTracks = tracker.iterTracks({
					tracks: [],
					detections,
					iteration: index
				});
			} else if (forceMatch && detections.length === 1) {
				iterationTracks = tracker.iterTracks({
					tracks: [newTrack],
					detections,
					iteration: index,
					forceMatched: [{detectionId: 0, trackId: 0}]
				});
			} else {
				iterationTracks = tracker.iterTracks({
					tracks: [newTrack],
					detections,
					iteration: index
				});
			}

			if (iterationTracks.length > 0) {
				newTrack = iterationTracks[0];
				if (iterationTracks.length > 1) {
					if (forceMatch) {
						console.log({index, iterationTracks});
						throw (new Error('when forceMatch, iterationTracks should have only one element'));
					}

					inactiveTracks.push(...iterationTracks.slice(1));
				}
			}
		}
	});
	return {
		track: newTrack,
		inactiveTracks
	};
};
