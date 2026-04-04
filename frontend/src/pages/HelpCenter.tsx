import { useState } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { useMode } from '../contexts/ModeContext';
import { GLOSSARY } from '../data/glossary';

type HelpTab = 'glossary' | 'techniques' | 'api-setup' | 'responsible';

const TECHNIQUES = [
  {
    name: 'Value Betting',
    difficulty: 'beginner' as const,
    description: 'Finding bets where the true probability of winning is higher than what the odds imply.',
    steps: [
      'Estimate the real probability of an outcome (using stats, research, models)',
      'Convert the sportsbook odds to implied probability',
      'If your estimated probability is HIGHER than the implied probability, you have value',
      'Only bet when you find value — never bet on hunches alone',
    ],
    tips: [
      'Start with sports you know well',
      'Focus on specific leagues or bet types to build expertise',
      'Track your results to see if your probability estimates are accurate',
    ],
  },
  {
    name: 'Line Shopping',
    difficulty: 'beginner' as const,
    description: 'Comparing odds across multiple sportsbooks to get the best price.',
    steps: [
      'Open accounts at 3-5 different sportsbooks',
      'Before placing any bet, check the odds at each book',
      'Always take the best price available',
      'Even small differences add up over hundreds of bets',
    ],
    tips: [
      'Use odds comparison sites to save time',
      'Pay attention to which books consistently offer better odds for your sport',
      'The Odds API can automate this comparison for you',
    ],
  },
  {
    name: 'Bankroll Management',
    difficulty: 'beginner' as const,
    description: 'Protecting your betting money by sizing bets appropriately.',
    steps: [
      'Set aside a fixed amount for betting — your bankroll',
      'Never bet more than 1-5% of your bankroll on a single bet',
      'Use the Kelly Criterion (in our Bankroll Manager) for optimal sizing',
      'Set daily, weekly, and monthly loss limits',
    ],
    tips: [
      'Quarter Kelly (betting 1/4 of what Kelly suggests) is safest for beginners',
      'Never chase losses by increasing bet size',
      'If you lose 20% of your bankroll, stop and reassess',
    ],
  },
  {
    name: 'Closing Line Value (CLV)',
    difficulty: 'intermediate' as const,
    description: 'Measuring if you consistently beat the closing line — the ultimate test of betting skill.',
    steps: [
      'Record the odds when you place your bet',
      'Check the odds right before the game starts (the closing line)',
      'If your odds were consistently better than the closing line, you have CLV',
      'Positive CLV over 500+ bets strongly indicates profitable long-term betting',
    ],
    tips: [
      'Bet early when you spot value — lines move as more information comes in',
      'CLV is a better predictor of skill than short-term win rate',
      'Some sportsbooks limit or ban sharp bettors who consistently beat the close',
    ],
  },
  {
    name: 'Correlation Parlays',
    difficulty: 'advanced' as const,
    description: 'Building parlays with legs that are positively correlated for better value.',
    steps: [
      'Identify outcomes that are linked (e.g., a team winning AND the game going over)',
      'Check if the sportsbook prices these independently (most do)',
      'Build parlays with correlated legs to exploit the pricing error',
      'Use small stakes — parlays are inherently higher variance',
    ],
    tips: [
      'Same-game parlays often have correlated legs',
      'Be aware that sportsbooks are improving at detecting correlations',
      'Never parlay uncorrelated long shots just for a big payout',
    ],
  },
];

const API_GUIDES = [
  {
    name: 'The Odds API',
    description: 'Free tier: 500 requests/month. Covers 20+ sports, 50+ sportsbooks worldwide.',
    steps: [
      'Go to https://the-odds-api.com and create a free account',
      'Copy your API key from the dashboard',
      'Add it to your .env file as THE_ODDS_API_KEY=your_key_here',
      'Sports Steve will automatically use it for odds comparison and edge detection',
    ],
    free: true,
  },
  {
    name: 'DraftKings (via lukhed-sports)',
    description: 'Uses the lukhed-sports Python package for DraftKings odds scraping. No API key needed.',
    steps: [
      'Install the optional dependency: pip install lukhed-sports',
      'Sports Steve automatically detects and uses it',
      'Provides real-time DraftKings odds for edge detection',
      'Note: DraftKings bet placement is simulated, not live',
    ],
    free: true,
  },
  {
    name: 'PrizePicks',
    description: 'Uses session cookies for PrizePicks prop odds. Requires manual cookie extraction.',
    steps: [
      'Log into PrizePicks in your browser',
      'Open Developer Tools (F12) and go to the Network tab',
      'Find a request to api.prizepicks.com and copy the session cookie',
      'Add PRIZEPICKS_SESSION_COOKIE and PRIZEPICKS_CSRF_TOKEN to your .env',
    ],
    free: true,
  },
];

export default function HelpCenter() {
  const { isBeginner } = useMode();
  const [activeTab, setActiveTab] = useState<HelpTab>('glossary');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTechnique, setExpandedTechnique] = useState<string | null>(null);

  const tabs: { id: HelpTab; label: string; beginnerLabel: string; icon: string }[] = [
    { id: 'glossary', label: 'Glossary', beginnerLabel: 'Betting Terms', icon: '📖' },
    { id: 'techniques', label: 'Techniques', beginnerLabel: 'How to Bet Smart', icon: '🎯' },
    { id: 'api-setup', label: 'API Setup', beginnerLabel: 'Get Live Odds', icon: '🔌' },
    { id: 'responsible', label: 'Responsible', beginnerLabel: 'Stay Safe', icon: '🛡️' },
  ];

  const filteredGlossary = GLOSSARY.filter(
    (entry) =>
      entry.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.definition.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const visibleTechniques = isBeginner
    ? TECHNIQUES.filter((t) => t.difficulty === 'beginner')
    : TECHNIQUES;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-display tracking-tight">
          {isBeginner ? 'Learn Betting' : 'Help Center'}
        </h1>
        <p className="text-text-secondary mt-1 text-sm">
          {isBeginner
            ? 'Everything you need to understand sports betting.'
            : 'Glossary, strategies, API setup, and responsible gambling resources.'}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
              ${activeTab === tab.id
                ? 'bg-white/[0.08] text-white border border-border-glass-hover'
                : 'text-text-muted hover:text-white hover:bg-white/[0.03]'
              }`}
          >
            <span>{tab.icon}</span>
            {isBeginner ? tab.beginnerLabel : tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'glossary' && (
        <div className="space-y-4">
          {/* Search */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isBeginner ? 'Search for a term...' : 'Filter terms...'}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-border-glass
                     text-white placeholder-text-muted text-sm
                     focus:outline-none focus:border-win/40 focus:ring-1 focus:ring-win/20"
          />

          {/* Category Labels */}
          {!searchTerm && (
            <div className="flex gap-2 flex-wrap">
              {['basics', 'odds', 'bet-types', 'bankroll', 'advanced'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSearchTerm(cat === searchTerm ? '' : '')}
                  className="px-3 py-1 text-[10px] uppercase tracking-wider rounded-full
                           bg-white/[0.04] border border-border-glass text-text-muted
                           hover:text-white hover:border-border-glass-hover transition-all"
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Terms Grid */}
          <div className="grid md:grid-cols-2 gap-3">
            {filteredGlossary.map((entry) => (
              <GlassCard key={entry.term} padding="sm" hover>
                <div className="flex items-start gap-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-win/10 text-win border border-win/20 uppercase tracking-wider font-medium flex-shrink-0 mt-0.5">
                    {entry.category}
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{entry.term}</h4>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                      {entry.definition}
                    </p>
                    {entry.example && (
                      <p className="text-[10px] text-text-muted mt-1.5 italic">
                        Example: {entry.example}
                      </p>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>

          {filteredGlossary.length === 0 && (
            <p className="text-center text-text-muted py-8">
              No terms found matching "{searchTerm}"
            </p>
          )}
        </div>
      )}

      {activeTab === 'techniques' && (
        <div className="space-y-4">
          {isBeginner && (
            <GlassCard className="border-win/10" glow="green">
              <p className="text-sm text-text-secondary">
                These are the fundamental techniques that professional bettors use.
                Master these basics before moving to Expert mode for advanced strategies.
              </p>
            </GlassCard>
          )}

          {visibleTechniques.map((technique) => (
            <GlassCard key={technique.name} padding="sm">
              <button
                onClick={() =>
                  setExpandedTechnique(
                    expandedTechnique === technique.name ? null : technique.name,
                  )
                }
                className="w-full text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium
                    ${technique.difficulty === 'beginner'
                      ? 'bg-win/10 text-win border border-win/20'
                      : technique.difficulty === 'intermediate'
                        ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                        : 'bg-loss/10 text-loss border border-loss/20'
                    }`}
                  >
                    {technique.difficulty}
                  </span>
                  <h3 className="text-base font-semibold text-white">{technique.name}</h3>
                </div>
                <span className="text-text-muted text-lg">
                  {expandedTechnique === technique.name ? '−' : '+'}
                </span>
              </button>

              {expandedTechnique === technique.name && (
                <div className="mt-4 space-y-4 animate-fade-in">
                  <p className="text-sm text-text-secondary">{technique.description}</p>

                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-text-muted mb-2">Steps</h4>
                    <ol className="space-y-2">
                      {technique.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="w-5 h-5 rounded-full bg-win/10 text-win text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                            {i + 1}
                          </span>
                          <span className="text-sm text-text-secondary">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-text-muted mb-2">Tips</h4>
                    <ul className="space-y-1.5">
                      {technique.tips.map((tip, i) => (
                        <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                          <span className="text-win mt-0.5">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {activeTab === 'api-setup' && (
        <div className="space-y-4">
          {isBeginner && (
            <GlassCard className="border-win/10" glow="green">
              <h3 className="font-semibold text-win mb-2">What Are API Feeds?</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                API feeds give Sports Steve access to <strong className="text-white">real-time odds data</strong> from
                sportsbooks. This is how the AI compares odds across multiple books to find the best bets.
                All the feeds below are <strong className="text-win">free</strong> to set up.
              </p>
            </GlassCard>
          )}

          {API_GUIDES.map((guide) => (
            <GlassCard key={guide.name}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-white">{guide.name}</h3>
                  <p className="text-xs text-text-secondary mt-0.5">{guide.description}</p>
                </div>
                {guide.free && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-win/10 text-win border border-win/20 uppercase tracking-wider font-medium">
                    Free
                  </span>
                )}
              </div>

              <ol className="space-y-2">
                {guide.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-white/[0.06] text-text-secondary text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm text-text-secondary">{step}</span>
                  </li>
                ))}
              </ol>
            </GlassCard>
          ))}
        </div>
      )}

      {activeTab === 'responsible' && (
        <div className="space-y-4">
          <GlassCard className="border-yellow-500/10">
            <div className="flex items-start gap-4">
              <span className="text-3xl">🛡️</span>
              <div>
                <h3 className="text-lg font-semibold text-yellow-500 mb-2">
                  Responsible Gambling
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Sports betting should be entertainment, not income. Even with the best AI and strategy,
                  losses are inevitable. The house always has an edge on most bets. Only bet what you
                  can truly afford to lose.
                </p>
              </div>
            </div>
          </GlassCard>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                title: 'Set Limits Before You Start',
                text: 'Decide your daily, weekly, and monthly limits BEFORE you start. Sports Steve enforces these automatically.',
              },
              {
                title: 'Never Chase Losses',
                text: 'If you lose, don\'t increase your bet size to "win it back." This is the fastest path to ruin.',
              },
              {
                title: 'Take Breaks',
                text: 'If you\'re on a losing streak, step away. Emotional betting leads to bad decisions.',
              },
              {
                title: 'Know the Warning Signs',
                text: 'Betting more than you planned, borrowing money to bet, or feeling anxious about bets are red flags.',
              },
            ].map((item) => (
              <GlassCard key={item.title} padding="sm">
                <h4 className="text-sm font-semibold text-white mb-1.5">{item.title}</h4>
                <p className="text-xs text-text-secondary leading-relaxed">{item.text}</p>
              </GlassCard>
            ))}
          </div>

          <GlassCard padding="sm">
            <h4 className="text-sm font-semibold text-white mb-2">Get Help</h4>
            <div className="space-y-1.5 text-xs text-text-secondary">
              <p>National Problem Gambling Helpline: <strong className="text-white">1-800-522-4700</strong></p>
              <p>Crisis Text Line: Text <strong className="text-white">HOME</strong> to <strong className="text-white">741741</strong></p>
              <p>Website: <strong className="text-white">ncpgambling.org</strong></p>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
