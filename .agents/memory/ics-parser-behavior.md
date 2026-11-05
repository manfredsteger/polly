---
name: ICS parser behavior
description: Parser-specific handling of custom iCalendar properties when testing RFC 5545 output.
---

ical.js does not automatically unescape text values on unregistered extension properties such as `X-WR-CALNAME`. Standard typed event fields such as `SUMMARY` and `DESCRIPTION` do decode escaped delimiters and embedded newlines.

**Why:** Parser-based ICS tests initially mistook the raw value of a custom property for a generator escaping defect, even though the calendar and event fields parsed correctly.

**How to apply:** Use registered RFC 5545 properties to assert decoded text semantics. For custom `X-` properties, assert structure or raw encoded values unless the parser's property design explicitly registers their value type.
