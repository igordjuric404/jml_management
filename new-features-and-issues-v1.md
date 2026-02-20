
1. The AI chatbot is not implemented as a persistent hovering button in the lower-right corner of the site that is always visible on screen. Implement it that way and it should open a chatbot window when clicked on

2. Chatbot is not really working. Example:
   - I asked: “Where are the audit logs stored?”
   - It replied with a generic intro: “I’m the OGM Help Assistant. I can answer questions about offboarding cases, access artifacts, findings, remediation, and security policies. What would you like to know?”
   Fix the chatbot so it actually answers the question and uses the available system context (docs/data) instead of responding with a canned greeting. Look at how the frappe integrated app implemented it and do It identical, same rag or whatever system it used.

3. You must style the docs significantly better. Right now everything is crammed and hard to read. Improve typography, spacing, layout, and overall readability. Sidebar with the 6 sections should have subsections and those are subpages, so main page with some overall details but really detailed stuff for subsections is it own render, not al in 1 view

4. Clicking on a table row should open the details page for that item. It shouldn’t require clicking only the name/id cell. Keep existing behavior where clicking on text in other columns can open details too for those objects, but ensure clicking empty space within the row opens that row’s item details.

5. Why do all cases have “run scheduled now”? Only some cases should have scheduled remediation. Investigate why everything is being scheduled and fix the scheduling logic/criteria. 

6. I’m on the findings table page. When I click a finding ID it does not open the finding details page. The URL changes but the UI still shows the table of all findings. Example:
   - https://jml-management.igordjuric404.workers.dev/findings?finding=FND-2025-00004
   Fix routing/navigation so clicking a finding reliably opens the actual details view.

7. Same issue as above for artifacts: clicking an artifact does not open its details page. Fix routing/navigation so artifact details open correctly.

8. Findings should be remediable, not only viewable. When I’m on the findings list page or a finding details page, I should be able to trigger remediation actions relevant to that finding.

9. Findings should have a “remediated” status just like cases. When all findings of a case have been remediated the case gets remediated a well. Ensure it is reflected consistently in list views and detail views. Findings should also be for medium and low artifacts. Currently, it's flagged as a finding only if it's high or critical

10. Confirmation prompts for actions should be custom toast notifications, not the browser’s native Chrome confirm dialogs.

11. I revoked access for Ivy Chen, but the Employee Access Overview page still shows she has 6 active artifacts and 4 open findings. However, her employee page shows revoked and that the case is remediated. Investigate why the overview page is stale/inconsistent and fix data refresh/state consistency.

12. Employee details Page should also have a table for artifacts. Order table first cases then findings and then artifacts  

13. Setting intervals and then refreshing clears them. Persist interval settings properly so a refresh does not reset them.

14. Test that automations are really working:
   - Test that the background scan actually runs every N interval. (these are not really often, every one hour, so for testing decrease this so you validate it faster)
   - Test that the remediation check interval actually checks and executes the remediation action.
   Create cases specifically for testing these behaviors, and validate with logs/state changes that the right actions occurred.

15. Table columns must be sortable. Add a small arrow next to each column name. Clicking anywhere in the column header should sort that column (not only clicking the text or only name/id columns).

16. Research free email-sending services and integrate one. It doesn’t need to be perfect; I only need to send a small number of emails. Requirement: when a new high or critical finding is found, send me an email notification. Use this sender email: igordjuric404@gmail.com.

17. Test the Frappe offboarding integration end-to-end:
   - Create a 2 users who are still active and should have permissions.
   - Trigger an event that the user is fired.
   - Trigger an event that the user is moved.
   Then verify what the JML system did:
   - Did it run a scan for that employee?
   - Did it find anything?
   - Did it remediate automatically (if that toggle is enabled)?
   - Did it send an email if high or critical?
   Validate the entire pipeline using logs and system state to confirm it behaved correctly.
