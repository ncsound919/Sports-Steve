import type { GlossaryEntry } from '../types';

export const GLOSSARY: GlossaryEntry[] = [
  // Basics
  { term: 'Bankroll', definition: 'The total amount of money you\'ve set aside specifically for betting. Never mix this with money you need for bills or essentials.', category: 'basics' },
  { term: 'Stake', definition: 'The amount of money you put on a single bet.', example: 'You bet $10 on the Lakers — your stake is $10.', category: 'basics' },
  { term: 'Action', definition: 'Having a bet placed on a game. "I\'ve got action on the Lakers" means you bet on them.', category: 'basics' },
  { term: 'Sharp', definition: 'A professional or highly skilled bettor who consistently wins. Sportsbooks track and sometimes limit sharps.', category: 'basics' },
  { term: 'Square', definition: 'A recreational or casual bettor. Not an insult — most bettors are squares.', category: 'basics' },
  { term: 'Sportsbook', definition: 'A company that accepts bets on sports events. Examples: DraftKings, FanDuel, BetMGM.', category: 'basics' },
  { term: 'Handle', definition: 'The total amount of money wagered on an event by all bettors.', category: 'basics' },
  { term: 'Juice / Vig / Vigorish', definition: 'The commission the sportsbook charges on bets. This is how they make money. Standard juice is -110 on both sides.', example: 'Both sides at -110 means you bet $110 to win $100. The extra $10 is the juice.', category: 'basics' },

  // Odds
  { term: 'American Odds', definition: 'Odds shown as + or - numbers. Positive (+150) shows profit on a $100 bet. Negative (-110) shows how much to bet to win $100.', example: '+150 means bet $100 to win $150 profit. -110 means bet $110 to win $100 profit.', category: 'odds' },
  { term: 'Decimal Odds', definition: 'Odds as a single number that shows your total return per $1 bet, including your stake.', example: '2.50 means you get $2.50 back for every $1 bet ($1.50 profit + $1 stake).', category: 'odds' },
  { term: 'Fractional Odds', definition: 'Odds shown as a fraction (e.g., 3/2). The first number is your profit, the second is your stake.', example: '3/2 means you win $3 for every $2 bet.', category: 'odds' },
  { term: 'Implied Probability', definition: 'The probability of an outcome as suggested by the odds. Convert odds to a percentage to see what the sportsbook thinks.', example: '-200 implies a 66.7% chance of winning.', category: 'odds' },
  { term: 'True Odds', definition: 'The actual probability of an outcome, without any juice built in. True odds are always better than the odds you\'re given.', category: 'odds' },
  { term: 'Closing Line', definition: 'The final odds offered right before an event starts. Considered the most accurate/efficient odds.', category: 'odds' },
  { term: 'Line Movement', definition: 'When odds change between opening and closing. Lines move based on betting activity and new information.', category: 'odds' },

  // Bet Types
  { term: 'Moneyline (ML)', definition: 'A bet on which team will win the game outright. No point spread involved.', example: 'Lakers ML at -150 means you bet on the Lakers to win.', category: 'bet-types' },
  { term: 'Spread / Point Spread', definition: 'A bet where one team is given a points handicap. The favorite must win by more than the spread.', example: 'Lakers -4.5 means they must win by 5 or more points for your bet to win.', category: 'bet-types' },
  { term: 'Over/Under (Total)', definition: 'A bet on whether the total combined score of both teams will be over or under a set number.', example: 'Over 224.5 means both teams\' scores must add up to 225 or more.', category: 'bet-types' },
  { term: 'Parlay', definition: 'A single bet that combines multiple selections. All legs must win for the parlay to pay. Higher risk, higher reward.', example: 'A 3-leg parlay: Lakers ML + Warriors ML + Celtics ML. All three must win.', category: 'bet-types' },
  { term: 'Prop Bet', definition: 'A bet on a specific occurrence within a game, not the final result.', example: 'LeBron James over 25.5 points, or first team to score.', category: 'bet-types' },
  { term: 'Futures', definition: 'A bet on an outcome that will be decided in the future, like who will win the championship.', example: 'Lakers to win the NBA Championship at +800.', category: 'bet-types' },
  { term: 'Live Betting / In-Play', definition: 'Placing bets while a game is in progress. Odds update in real time.', category: 'bet-types' },
  { term: 'Teaser', definition: 'A type of parlay where you can adjust the spread in your favor, but with reduced odds.', category: 'bet-types' },

  // Bankroll
  { term: 'Kelly Criterion', definition: 'A mathematical formula that tells you the optimal bet size based on your edge and odds. Used by professional gamblers and investors.', category: 'bankroll' },
  { term: 'Unit', definition: 'A standardized bet size, usually 1-2% of your bankroll. Makes it easier to track performance across different bankroll sizes.', example: 'With a $1,000 bankroll and 1% unit size, 1 unit = $10.', category: 'bankroll' },
  { term: 'ROI (Return on Investment)', definition: 'Your total profit divided by your total amount wagered, expressed as a percentage.', example: '5% ROI means you\'ve profited $5 for every $100 wagered.', category: 'bankroll' },
  { term: 'Stop-Loss', definition: 'A predetermined loss limit that triggers you to stop betting for the day/session.', category: 'bankroll' },
  { term: 'Flat Betting', definition: 'Betting the same amount (1 unit) on every bet regardless of confidence. The simplest bankroll strategy.', category: 'bankroll' },
  { term: 'Gubbing / Limiting', definition: 'When a sportsbook restricts your account by lowering max bet sizes or removing promotions because you win too much.', category: 'bankroll' },

  // Advanced
  { term: 'Edge', definition: 'Your advantage over the sportsbook. If you estimate 55% win probability but the odds imply 50%, your edge is 5%.', category: 'advanced' },
  { term: 'Expected Value (EV)', definition: 'The average amount you\'d win/lose per bet if you placed it thousands of times. Positive EV (+EV) = profitable long-term.', example: 'A coin flip bet at +110 has positive EV because you\'re getting better than fair odds.', category: 'advanced' },
  { term: 'CLV (Closing Line Value)', definition: 'Whether you got better odds than the closing line. Consistently beating the close is the strongest indicator of a winning bettor.', category: 'advanced' },
  { term: 'No-Vig Odds', definition: 'The "true" odds after removing the sportsbook\'s commission. Useful for comparing across books.', category: 'advanced' },
  { term: 'Hold Percentage', definition: 'The sportsbook\'s built-in margin on a market. A 5% hold means the book expects to keep 5% of all money wagered.', category: 'advanced' },
  { term: 'Correlation', definition: 'When two outcomes are linked — if one happens, the other becomes more or less likely.', example: 'If a team wins big, the game is more likely to go over the total. These are correlated.', category: 'advanced' },
  { term: 'Variance / Swings', definition: 'The natural ups and downs of betting results. Even great bettors have losing months. A larger sample size smooths out variance.', category: 'advanced' },
  { term: 'Steam Move', definition: 'A sudden, significant line movement caused by sharp bettors or syndicates placing large bets.', category: 'advanced' },
  { term: 'Arbitrage (Arb)', definition: 'Betting on all outcomes of an event across different books to guarantee profit regardless of result. Rare and books hate it.', category: 'advanced' },
  { term: 'Middle', definition: 'Betting both sides of a game at different spreads to win both bets if the final score lands in between.', example: 'Bet Lakers -3 at one book and Celtics +5 at another. If Lakers win by 4, both bets win.', category: 'advanced' },
];
