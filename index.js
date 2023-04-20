module.exports = {
	GlobalMatching: require('./lib/global-matching'),
	MatchingStage: require('./lib/matching-stage'),
	Tracker: require('./lib/tracker'),
	getDistances: require('./lib/matching-cascade/get-distances'),
	lambdaSumDistances: require('./lib/matching-cascade/lambda-sum-distances')
};
