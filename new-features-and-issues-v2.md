0) HARD REQUIREMENTS / CONTEXT
- You MUST commit current changes and deploy to production (Cloudflare). Cloudflare credentials should already exist in the env file
- For GitHub actions/auth, first ensure you’re using the igordjuric404 account.
- Production still uses localhost Frappe; that’s acceptable for this hackathon setup.
- You are not allowed to continue to any improvement work until you have confirmed the deployed production build is working.

1) COMMIT + DEPLOY + PRODUCTION VALIDATION (BLOCKER)
- Commit the current working changes and deploy them to Cloudflare production.
- Validate in production that the employee pages show real artifact data (the “really long artifact values”).
- Concrete validation method: fetch/grep the production page HTML for the test employees and confirm the output contains the real long artifact values (not empty tables, not mock data).
- Only after this validation is successful are you allowed to proceed to the improvements below.

2) GRANULAR REVOCATION ON EMPLOYEE PAGE (SELECT ONE/MANY)
- Implement granular revocation in the artifact table: allow selecting one artifact, multiple artifacts, or all artifacts, then revoke only the selected set.
- Keep the existing “Revoke all” button; this is an additional more precise revoke option.
- Ensure the UI truly works end-to-end (selection + action + resulting state), not just the backend command.
- Validate by revoking exactly ONE known artifact and confirming only that one is removed (and nothing else is revoked). Use minimal changes for validation: revoke one of these example artifacts and verify scope is correct:
  - angelina from outlook OR teams 
  - john wick from sharepoint
  - devid from copilot
- Add a test approach:
  - If automated UI testing exists, add/extend tests to simulate selection and verify only the selected artifact is removed.
  - If not, implement the most reliable simulation you can (while still proving the UI and data refresh are correct) and document the exact steps and expected results.
  - I also test if the status of the artifact is being changed correctly to revoked, for example

3) DATA CONSISTENCY ACROSS PAGES (SAME SOURCE OF TRUTH)
- Ensure all pages fetch and display the same artifact/grant data consistently (not only the employee detail page).
- Current known mismatches that must be fixed:
  - John has 15 grants on the employee page, but Employee Access Overview shows zero.
  - Access Artifacts table shows no data, even though each user has 15+ artifacts visible in their employee detail page.
  - OAuth App Dashboard page is also inconsistent / missing the same underlying data. This should list all the apps that are tied to the artifacts
- Fix the underlying data access/query logic so these pages display accurate counts and lists, and refresh correctly after changes.

4) OFFBOARDING + FINDINGS PIPELINE VISIBILITY (WITH SETTINGS CHECK)
- Before doing anything in this section, verify settings:
  - Auto remediate on offboarding: OFF
  - Auto create case on leave: ON
- Then test end-to-end visibility and case creation:
  - Offboard one of the employees in Frappe using an effective date in the future (so they are not “fired yet”).
  - Their status should become “to leave”.
  - This action should automatically create an offboarding case.
  - It should also convert the user’s artifacts into findings (those artifacts should now also be represented as findings tied to that case).
- Confirm the data is actually being shown correctly in the Offboarding and Findings pages (not only created in the DB).

5) GRANULAR REVOCATION ON OFFBOARDING CASE (SAME UX AS EMPLOYEE DETAILS)
- After confirming cases and findings are being created and displayed, implement the same granular artifact revocation UI within the offboarding case and findings details page 
- This should match the employee detail functionality: select one/many/all artifacts and revoke only the selected.
- Verify it works by revoking exactly one of these examples and confirming only that one artifact is removed (previous step might have removed an employee from this app so verify which one exists, and then try to revoke it, one from the case, details page, one from the finding page):
  - angelina from outlook or teams
  - john wick from sharepoint
  - devid from copilot

6) EMAIL NOTIFICATIONS (REMEDIATION ONLY)
- enable notification rules so email is sent ONLY on a remediation event (do NOT notify on “new finding”).
- Test that email notification still works after the automated revocation that will be executed in the next step, using igordjuric404@gmail.com as the recipient. 

7) AUTOMATIONS: AUTO-REMEDIATE ON OFFBOARDING (PRODUCTION TEST)
- After you have verified manual granular revocation works everywhere artifacts appear, move on to automations.
- Enable auto remediate on offboarding in the settings.
- Offboard one of the employees in Frappe using an effective date in the future (so they are not “fired yet” and have status “to leave”).
- “Trick” the production system date/time (or otherwise simulate time progression) so the offboarding effective date condition is met in a controlled way, and the automation triggers.
- Expected behavior:
  - Automation should revoke all access for the offboarded user.
  - Verify in the UI and underlying data that access is removed completely for that specific user and status of the artifacts is changed to revoked for example
  - status of the employees changed to left
- Keep the test narrow and controlled: only validate the targeted offboarded user, and do not accidentally revoke unrelated users.
