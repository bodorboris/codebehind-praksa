const fs = require("fs");

const groups = JSON.parse(fs.readFileSync("groups.json", "utf-8"));

function simulateMatch(teamA, teamB) {
	if (!teamA || !teamB || teamA.FIBARanking === undefined || teamB.FIBARanking === undefined) {
		console.error("Error: One or both teams are missing FIBARanking");
		console.error("Team A:", teamA);
		console.error("Team B:", teamB);
		throw new Error("Team missing FIBARanking");
	}

	const rankingDiff = teamA.FIBARanking - teamB.FIBARanking;
	const teamAWinProbability = 0.5 + rankingDiff * 0.02;
	let teamAScore = Math.floor(Math.random() * 50) + 50;
	let teamBScore = Math.floor(Math.random() * 50) + 50;

	// Ensure no tie
	if (teamAScore === teamBScore) {
		if (Math.random() < 0.5) {
			teamAScore += 1;
		} else {
			teamBScore += 1;
		}
	}

	const winner = teamAScore > teamBScore ? teamA : teamB;

	return {
		winner,
		teamAScore,
		teamBScore,
	};
}

function simulateGroupMatches(group) {
	const results = [];

	for (let i = 0; i < group.length; i++) {
		for (let j = i + 1; j < group.length; j++) {
			const teamA = group[i];
			const teamB = group[j];

			try {
				const matchResult = simulateMatch(teamA, teamB);
				const winner = matchResult.winner;

				if (winner === teamA) {
					teamA.points += 2;
					teamB.points += 1;
				} else {
					teamA.points += 1;
					teamB.points += 2;
				}

				results.push({
					teamA: teamA.Team,
					teamB: teamB.Team,
					winner: winner.Team,
					teamAScore: matchResult.teamAScore,
					teamBScore: matchResult.teamBScore,
				});
			} catch (error) {
				console.error("Error simulating match between", teamA, "and", teamB);
				throw error;
			}
		}
	}

	return results;
}

for (let groupName in groups) {
	groups[groupName].forEach((team) => {
		team.points = 0;
	});
}

const allResults = [];
for (let groupName in groups) {
	const groupResults = simulateGroupMatches(groups[groupName]);
	allResults.push(...groupResults);
}

console.log("Group Stage Results:");
allResults.forEach((result) => {
	console.log(`  ${result.teamA} - ${result.teamB} (${result.teamAScore}:${result.teamBScore})`);
});

function calculateStandings(groups) {
	const standings = {};

	for (let groupName in groups) {
		const sortedTeams = groups[groupName].sort((a, b) => {
			if (b.points !== a.points) return b.points - a.points;
			return 0;
		});
		standings[groupName] = sortedTeams;
	}

	return standings;
}

const finalStandings = calculateStandings(groups);
console.log("\nFinal Standings:");
for (let groupName in finalStandings) {
	console.log(`  Group ${groupName}:`);
	finalStandings[groupName].forEach((team, index) => {
		console.log(`    ${index + 1}. ${team.Team} ${team.points} points`);
	});
}

const qualifiedTeams = {
	D: [], // Pot D (Top teams)
	E: [], // Pot E (Second teams)
	F: [], // Pot F (Third teams)
	G: [], // Pot G (Fourth teams)
};

Object.keys(finalStandings).forEach((groupName) => {
	const groupTeams = finalStandings[groupName];
	qualifiedTeams.D.push(groupTeams[0]);
	qualifiedTeams.E.push(groupTeams[1]);
	qualifiedTeams.F.push(groupTeams[2]);
	if (groupTeams[3]) {
		qualifiedTeams.G.push(groupTeams[3]);
	}
});

console.log("\nDraw Pots:");
Object.keys(qualifiedTeams).forEach((pot) => {
	console.log(`  Pot ${pot}:`);
	qualifiedTeams[pot].forEach((team) => {
		console.log(`    ${team.Team}`);
	});
});

function generateKnockoutPairs(pot1, pot2) {
	const pairs = [];
	const pot1Teams = [...qualifiedTeams[pot1]];
	const pot2Teams = [...qualifiedTeams[pot2]];

	while (pot1Teams.length && pot2Teams.length) {
		const teamA = pot1Teams.shift();
		const teamB = pot2Teams.find((team) => team.Group !== teamA.Group);

		if (teamB) {
			pairs.push({ teamA, teamB });
			pot2Teams.splice(pot2Teams.indexOf(teamB), 1);
		} else {
			pairs.push({ teamA, teamB: pot2Teams.shift() });
		}
	}
	return pairs;
}

const quarterFinalPairs = [...generateKnockoutPairs("D", "G"), ...generateKnockoutPairs("E", "F")];

if (quarterFinalPairs.length < 4) {
	console.error("Not enough teams qualified for the quarter-finals.");
	process.exit(1);
}

function simulateKnockoutStage(pairs) {
	const winners = [];
	const losers = [];
	const results = [];
	pairs.forEach((pair) => {
		if (pair.teamA && pair.teamB) {
			try {
				const matchResult = simulateMatch(pair.teamA, pair.teamB);
				const winner = matchResult.teamAScore > matchResult.teamBScore ? pair.teamA : pair.teamB;
				const loser = winner === pair.teamA ? pair.teamB : pair.teamA;
				winners.push(winner);
				losers.push(loser);
				results.push({
					teamA: pair.teamA.Team,
					teamB: pair.teamB.Team,
					teamAScore: matchResult.teamAScore,
					teamBScore: matchResult.teamBScore,
				});
			} catch (error) {
				console.error("Error simulating knockout match between", pair.teamA, "and", pair.teamB);
				throw error;
			}
		}
	});
	return { winners, losers, results };
}

const quarterFinalResults = simulateKnockoutStage(quarterFinalPairs);

if (quarterFinalResults.winners.length < 4) {
	console.error("Not enough teams qualified for the semi-finals.");
	process.exit(1);
}

const semiFinalPairs = [
	{ teamA: quarterFinalResults.winners[0], teamB: quarterFinalResults.winners[1] },
	{ teamA: quarterFinalResults.winners[2], teamB: quarterFinalResults.winners[3] },
];

const semiFinalResults = simulateKnockoutStage(semiFinalPairs);

if (semiFinalResults.winners.length < 2) {
	console.error("Not enough teams qualified for the final.");
	process.exit(1);
}

const finalPairs = [{ teamA: semiFinalResults.winners[0], teamB: semiFinalResults.winners[1] }];
const thirdPlacePairs = [{ teamA: semiFinalResults.losers[0], teamB: semiFinalResults.losers[1] }];

const finalResults = simulateKnockoutStage(finalPairs);
const thirdPlaceResults = simulateKnockoutStage(thirdPlacePairs);

console.log("\nQuarter-Final Matches:");
quarterFinalResults.results.forEach((result) => {
	console.log(`  ${result.teamA} vs ${result.teamB} (${result.teamAScore}:${result.teamBScore})`);
});

console.log("\nSemi-Final Matches:");
semiFinalResults.results.forEach((result) => {
	console.log(`  ${result.teamA} vs ${result.teamB} (${result.teamAScore}:${result.teamBScore})`);
});

console.log("\nThird Place Match:");
thirdPlaceResults.results.forEach((result) => {
	console.log(`  ${result.teamA} vs ${result.teamB} (${result.teamAScore}:${result.teamBScore})`);
});

console.log("\nFinal Match:");
finalResults.results.forEach((result) => {
	console.log(`  ${result.teamA} vs ${result.teamB} (${result.teamAScore}:${result.teamBScore})`);
});

console.log("\nMedal Winners:");
if (finalResults.winners.length > 0) {
	console.log(`  Gold Medal: ${finalResults.winners[0].Team}`);
	console.log(`  Silver Medal: ${finalResults.losers[0].Team}`);
}
if (thirdPlaceResults.winners.length > 0) {
	console.log(`  Bronze Medal: ${thirdPlaceResults.winners[0].Team}`);
}
