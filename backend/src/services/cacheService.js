import NodeCache from "node-cache";

export const cache = new NodeCache({
  stdTTL: 60 * 30,
  checkperiod: 120
});
