# Quiet Studio

A small booking app: customers see the classes, book a place and cancel it; the page keeps
working when the network drops.

## Run

    npm start

It serves on `PORT` (default 3000). Bookings are kept in `data/state.json`, so they survive a restart.

## Test

    npm test

Runs the Node test runner against the HTTP API (`node --test`).
