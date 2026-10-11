// Launcher for the S probes: wires the build's own modules into a running server.
// One class "c1" (capacity 1, 1500 cents) with one paid booking and two customers waiting.
// Fails to start when the feature (joinWaitlist, the waitlist route) is not in the build.
import path from "node:path";
import { pathToFileURL } from "node:url";

const dir = process.env.GRADE_BUILD_DIR;
const load = (rel) => import(pathToFileURL(path.join(dir, rel)).href);
const b = await load("src/bookings.mjs");
const { createServer } = await load("src/server.mjs");
const { fakeGateway } = await load("src/payments.mjs");
const store = b.createStore();
const gateway = fakeGateway();
b.addClass(store, { id: "c1", capacity: 1, priceCents: 1500 });
await b.book(store, "c1", "u1", gateway);
b.joinWaitlist(store, "c1", "u2");
b.joinWaitlist(store, "c1", "u3");
createServer(store, gateway).listen(Number(process.env.PORT), "127.0.0.1");
