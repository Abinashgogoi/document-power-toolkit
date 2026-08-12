# Security policy

## Supported version

The current `0.1.x` milestone receives security fixes.

## Data handling

Document contents are processed locally. The application does not send selected files, filenames, or file paths to a server. Operation history stores only tool name, timestamp, sizes, duration, settings, and verification status in IndexedDB on the current device.

Original input files are never overwritten. Processing produces a new browser Blob and offers it as a separate download.

## Reporting a vulnerability

Do not open a public issue containing sensitive documents, credentials, or exploitable details. Use the repository's private security-advisory workflow after the dedicated repository is created.
