# PostgreSQL Backup Strategy

This document defines the practical backup approach for Life OS in its current stage: personal use, low traffic, and a very small user base.

## Current state

- The backend uses PostgreSQL.
- Production currently points at a local PostgreSQL instance on the same VPS.
- The database is currently stored in a local Docker volume.
- The repo now includes a production backup script and systemd timer templates:
  - `deploy/scripts/life-os-postgres-backup.sh`
  - `deploy/systemd/life-os-postgres-backup.service`
  - `deploy/systemd/life-os-postgres-backup.timer`
- The backup script creates a custom-format `pg_dump`, writes a SHA-256 checksum, uploads both files to an encrypted off-server `rclone` remote, and prunes local backups after `BACKUP_RETENTION_DAYS`.
- Production is not considered backup-protected until the timer is installed on the VPS, `/etc/life-os/backup.env` defines `RCLONE_REMOTE`, and a restore test has succeeded.

## Current risk

Right now, the app should survive normal restarts, but it is not protected against host-level loss.

If the VPS, disk, or Docker volume is lost, deleted, or corrupted, there is no confirmed second copy of the data to restore from.

## Recommended approach

For this application, the best fit is:

1. Create a PostgreSQL dump on a schedule.
2. Keep a small rolling set of recent backups on the server.
3. Upload encrypted copies to a free off-server storage account.
4. Test restore regularly.

This is the recommended default because it is:

- free or close to free
- simple to operate
- easy to understand
- appropriate for a low-scale personal app
- much safer than relying on one Docker volume on one VPS

## Recommended stack

### Database backup format

Use `pg_dump` in custom format.

Reason:

- it is the standard PostgreSQL backup tool
- it is easy to restore with `pg_restore`
- it supports compressed, portable dump files

### Off-server storage

Use a free cloud account that already exists, such as:

- Google Drive if the backup size comfortably fits within the free storage allowance
- OneDrive if the backup size is small enough for the free allowance

### Sync tool

Use `rclone` to upload backups.

Reason:

- simple to automate
- works with Google Drive and OneDrive
- supports encrypted remote storage via `crypt`

### Encryption

Encrypt backups before or during upload.

This app stores sensitive personal data, including planning, health, finance, and reflection data. Backups should not be kept in plain form in consumer cloud storage.

## Recommended schedule

For current usage:

- run `life-os-postgres-backup.timer` every night at 02:45 server time
- keep at least 14 days of local backups via `BACKUP_RETENTION_DAYS=14`
- keep off-server copies according to the encrypted remote's retention policy
- run a manual restore test at least monthly

If the app starts receiving meaningful data throughout the day and losing up to 24 hours becomes unacceptable, increase frequency to every 6 or 12 hours.

## Recovery target

The realistic recovery goal for the current app should be:

- restore the database after total VPS loss
- restore within a straightforward manual process
- accept some data loss up to the last successful backup

For current scale, this is acceptable and much simpler than full high-availability or point-in-time recovery.

## Why this is the best option right now

This app does not need a complex backup platform yet.

More advanced options like continuous WAL archiving, point-in-time recovery, managed database replicas, or cross-region failover add cost and operating complexity that do not match the current product stage.

The main risk right now is not high write throughput. The main risk is having only one copy of the database on one machine.

The recommended solution directly addresses that risk with the least complexity.

## Options considered

### Option 1: Keep doing nothing

Not acceptable.

This leaves the database exposed to permanent loss if the VPS or Docker volume fails.

### Option 2: Local dumps only on the same VPS

Better than nothing, but still weak.

This helps with accidental database damage but does not help if the VPS itself is lost.

### Option 3: Daily encrypted dumps pushed to free cloud storage

Recommended.

This is the best balance of safety, simplicity, and zero-cost operation for the current app.

### Option 4: Provider snapshots only

Acceptable only as an extra layer, not as the only plan.

Snapshots can help, but they are outside the application runbook and are easy to assume without verifying. They also do not replace regular restore-tested database backups.

### Option 5: Point-in-time recovery or replica setup

Not recommended right now.

This is useful for larger systems, but it is unnecessary overhead for a personal app with a handful of users.

## Minimum backup policy

The minimum acceptable policy for Life OS should be:

- at least one automated PostgreSQL backup per day
- at least one encrypted off-server copy
- at least 7 days of rolling retention
- at least one successful restore test after setup
- repeat restore testing at least monthly or after major backup changes

## Restore expectation

Backups are only useful if restore is known to work.

The restore process should be tested into a separate database or temporary environment so that:

- the dump file is verified
- the restore time is known
- the steps are documented
- recovery does not depend on guesswork during an outage

## Recommended next implementation

The first production implementation is now represented by the checked-in script and systemd templates. Install it with the production deployment runbook, then verify the following:

1. `rclone config` includes an encrypted remote.
2. `/etc/life-os/backup.env` contains `RCLONE_REMOTE=<encrypted-remote>:<path>`.
3. `systemctl list-timers life-os-postgres-backup.timer --no-pager` shows the next run.
4. `journalctl -u life-os-postgres-backup.service -n 80 --no-pager` shows successful upload.
5. A backup can be restored into a separate database with `pg_restore`.

Keep the first version intentionally small and boring.

## Future upgrade path

If the app grows, the next upgrades should be considered in this order:

1. Increase backup frequency.
2. Add a second off-server destination.
3. Add provider snapshots as a second layer.
4. Add WAL archiving and point-in-time recovery.
5. Move to a managed PostgreSQL service if operations become a burden.

## Decision

The approved direction for the current stage of Life OS is:

Daily encrypted PostgreSQL dumps, retained locally for a short window and copied off-server to free cloud storage.
