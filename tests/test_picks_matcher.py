"""Tests for the OddsAPI → PrizePicks picks matching service."""

import pytest
from src.services.picks_matcher import PicksMatcher, MatchedPick


class TestPicksMatcher:
    """Tests for PicksMatcher."""

    @pytest.mark.asyncio
    async def test_matcher_initializes_with_brokers(self):
        brokers = {}
        matcher = PicksMatcher(brokers=brokers)
        assert matcher._brokers == brokers

    @pytest.mark.asyncio
    async def test_fetch_picks_empty_without_oddsapi(self):
        brokers = {"prizepicks": "pp_broker"}
        matcher = PicksMatcher(brokers=brokers)
        picks = await matcher.fetch_picks(sports=["NBA"])
        assert picks == []

    @pytest.mark.asyncio
    async def test_fetch_picks_with_oddsapi_and_prizepicks(self):
        class MockOddsApiBroker:
            async def get_odds(self, sport, event_ids):
                return {
                    "game1": {
                        "home_team": "Lakers",
                        "away_team": "Celtics",
                        # Dog odds: +130 gives ~43% implied, PP at 1.82 gives ~55% → edge > 0
                        "best_odds": {"home": {"price": 130}, "away": {"price": -150}},
                    },
                }

        class MockPrizePicksBroker:
            async def get_odds(self, sport, event_ids):
                return {
                    "proj1": {
                        "player": "Luka Doncic",
                        "stat_type": "Points",
                        "line": 25.5,
                        "odds": 1.82,
                        "game_id": "game1",
                    },
                }

        brokers = {"oddsapi": MockOddsApiBroker(), "prizepicks": MockPrizePicksBroker()}
        matcher = PicksMatcher(brokers=brokers)
        picks = await matcher.fetch_picks(sports=["NBA"])
        assert len(picks) == 1
        assert picks[0].player == "Luka Doncic"
        assert picks[0].pp_line == 25.5

    @pytest.mark.asyncio
    async def test_filter_by_confidence_requires_min_edge(self):
        class MockOddsApiBroker:
            async def get_odds(self, sport, event_ids):
                return {
                    "game1": {
                        "home_team": "Lakers",
                        "away_team": "Celtics",
                        # +140 gives ~42% implied → PP 55% - 42% - 2% vig = 11% edge
                        "best_odds": {"home": {"price": 140}, "away": {"price": -160}},
                    },
                }

        class MockPrizePicksBroker:
            async def get_odds(self, sport, event_ids):
                return {
                    "proj1": {
                        "player": "Luka Doncic",
                        "stat_type": "Points",
                        "line": 25.5,
                        "odds": 1.82,
                        "game_id": "game1",
                    },
                }

        brokers = {"oddsapi": MockOddsApiBroker(), "prizepicks": MockPrizePicksBroker()}
        matcher = PicksMatcher(brokers=brokers)
        picks = await matcher.fetch_picks(sports=["NBA"], min_edge=0.10)
        assert len(picks) == 1


class TestMatchedPick:
    def test_matched_pick_dataclass(self):
        pick = MatchedPick(
            player="LeBron James",
            stat_type="Points",
            pp_line=25.5,
            odds=1.82,
            pp_projection_id="proj1",
            game_id="game1",
            oddsapi_home="Lakers",
            oddsapi_away="Celtics",
            oddsapi_line="Lakers -150",
            home_price=-150,
            away_price=130,
            edge=0.05,
            sport="NBA",
        )
        assert pick.player == "LeBron James"
        assert pick.pp_line == 25.5
        assert pick.stat_type == "Points"
        assert pick.edge == 0.05
