import { BigNumber } from "ethers";
import axios from "axios";
import axiosRetry from "axios-retry";
import { StraddleTrade, TradeResponse } from "../models";
import { useEffect, useState } from "react";
import { useDebounceCallback } from "@react-hook/debounce";

axiosRetry(axios, { retries: 2, retryDelay: axiosRetry.exponentialDelay });

const zero = BigNumber.from("0");

const emptyTrade = {
  venues: [],
  callVenue: "",
  putVenue: "",
  amounts: [],
  totalPremium: zero,
  callPremium: zero,
  callStrikePrice: zero,
  putPremium: zero,
  putStrikePrice: zero,
  buyData: [],
  gasPrice: zero,
  strikePrices: [],
  optionTypes: [],
  callIndex: 0,
  putIndex: 0,
};

const SOR_API_URL = "/api/sor";

const scaleFactor = BigNumber.from("10").pow(BigNumber.from("16"));

type StraddleTradeResponse = StraddleTrade & {
  loading: boolean;
  error: Error | null;
};

export const useStraddleTrade = (
  instrumentAddress: string,
  spotPrice: number,
  buyAmount: BigNumber
): StraddleTradeResponse => {
  const [trade, setTrade] = useState<StraddleTradeResponse>({
    ...emptyTrade,
    loading: true,
    error: null,
  });

  const buyAmountString = buyAmount.toString();

  const getBestTrade = useDebounceCallback(
    async () => {
      setTrade({ ...trade, loading: true });
      const spotPriceInWei = BigNumber.from(
        Math.ceil(spotPrice * 100).toString()
      ).mul(scaleFactor);

      const data: Record<string, string> = {
        instrument: instrumentAddress,
        spotPrice: spotPriceInWei.toString(),
        buyAmount: buyAmountString,
      };
      const query = new URLSearchParams(data).toString();
      const url = `${SOR_API_URL}?${query}`;

      try {
        const response = await axios.get(url);
        const trade = convertTradeResponseToStraddleTrade(response.data);
        setTrade({ ...trade, loading: false, error: null });
      } catch (e) {
        setTrade({ ...emptyTrade, loading: false, error: e });
        throw e;
      }
    },
    100,
    true
  );

  useEffect(() => {
    if (!BigNumber.from(buyAmountString).isZero() && spotPrice > 0) {
      getBestTrade();
    }
  }, [buyAmountString, getBestTrade, spotPrice]);

  return trade;
};

const convertTradeResponseToStraddleTrade = (
  response: TradeResponse
): StraddleTrade => {
  const {
    venues,
    totalPremium,
    amounts,
    premiums,
    strikePrices,
    buyData,
    gasPrice,
    optionTypes,
    callIndex,
    putIndex,
  } = response;

  return {
    venues,
    callVenue: venues[callIndex],
    putVenue: venues[putIndex],
    totalPremium: BigNumber.from(totalPremium),
    amounts: amounts.map((a) => BigNumber.from(a)),
    callPremium: BigNumber.from(premiums[callIndex]),
    callStrikePrice: BigNumber.from(strikePrices[callIndex]),
    putPremium: BigNumber.from(premiums[putIndex]),
    putStrikePrice: BigNumber.from(strikePrices[putIndex]),
    strikePrices: strikePrices.map((s) => BigNumber.from(s)),
    optionTypes,
    buyData,
    gasPrice: BigNumber.from(gasPrice),
    callIndex,
    putIndex,
  };
};
