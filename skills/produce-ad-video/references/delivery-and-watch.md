# Delivery and founder watch

A file on the **render VM** is not a file on the founder’s **Windows Downloads**.

## Write here

`~/delivery/<slug>/` with **exact** names the WI asked for, plus `DELIVERY-RECEIPT.md`.

Receipt must include: ffprobe, SHA-256, ebur128 (I / LRA / true peak), what was watched/listened, spectrogram notes for any audio complaint, and **which Windows folder** CoS should pull.

## Do not

- Claim you wrote `C:\Users\...\Downloads\...` from a Linux VM without `/mnt/c`
- Overwrite the previous FAIL folder without saying so (founders keep that path open)
- Use a new slug (`…-audio`) then expect the old Downloads folder to update

## Pull (from Windows WSL, where `/mnt/c` exists)

If the product repo has `scripts/pull-vm-delivery-to-windows.sh`:

```bash
bash ~/app-workspaces/<product>/scripts/pull-vm-delivery-to-windows.sh <slug>
```

That rsyncs `vm-agent-swarm:~/delivery/<slug>/` → `C:\Users\Dell\Downloads\<slug>\`.

## Paid-media gate

Instrument checks (stills, spectrogram, ebur128) can FAIL a delivery. They cannot PASS paid media. Founder watches **sound-on and sound-off**. Say that in the receipt.
