// Local development only. Some home routers intermittently refuse to resolve *.neon.tech.
// When the system lookup fails, retry through public resolvers inside this Node process.
// No system setting is changed. Loaded with: node --import ./scripts/dns-fallback.mjs
import dns from "node:dns";
import { Agent, setGlobalDispatcher } from "undici";

const resolver = new dns.promises.Resolver();
resolver.setServers(["1.1.1.1", "8.8.8.8"]);

function lookup(hostname, options, callback) {
  dns.lookup(hostname, options, async (err, address, family) => {
    if (!err) return callback(null, address, family);
    try {
      const [ip] = await resolver.resolve4(hostname);
      if (options?.all) return callback(null, [{ address: ip, family: 4 }]);
      callback(null, ip, 4);
    } catch {
      callback(err);
    }
  });
}

setGlobalDispatcher(new Agent({ connect: { lookup } }));
