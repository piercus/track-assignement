module.exports = {
	GlobalMatching: require('./lib/global-matching'),
	Tracker: require('./lib/tracker'),
	ProjectiveTracker: require('./lib/projective-tracker'),
	Projection: require('./lib/projection'),
	projectObservation: require('./lib/utils/project-observation'),
	dynamic: require('./lib/dynamic'),
	detection2track: require('./lib/distances/detection2track'),
	observation: require('./lib/observation'),
	strategies: require('./lib/strategies'),
	getFusioner: require('./lib/utils/fusion/get-fusioner')
};
