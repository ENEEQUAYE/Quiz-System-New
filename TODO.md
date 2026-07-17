# TODO - Resource menu (admin + student)

## Plan to implement
1. Create a new `Resource` model in backend (MongoDB) to store lesson title + link/url + optional description + createdBy.
2. Add new backend admin routes:
   - POST `/api/admin/resources` (create link)
   - GET `/api/admin/resources` (list)
   - DELETE `/api/admin/resources/:id` (remove)
3. Add new backend student routes:
   - GET `/api/students/resources` (public to authenticated students)
4. Update `frontend/admin-dashboard.html`:
   - Add a new sidebar menu item “Resources”
   - Add a new hidden content section with a table/list + form to upload/add a resource link
5. Update `frontend/js/admin-dashboard.js`:
   - Add navigation target handling for `#resources`
   - Implement `loadResources()` and handlers for creating/deleting resources
6. Update `frontend/student-dashboard.html`:
   - Add sidebar menu item “Resources”
   - Add a new hidden dashboard section to list resources with clickable links
7. Update `frontend/js/student-dashboard.js`:
   - Add navigation handling for `#resources`
   - Implement `loadResources()` to fetch and render student resources
8. Add minimal styling to existing CSS files if needed.
9. Test end-to-end:
   - Admin can add a resource and it appears immediately
   - Student can see resources and click to open

