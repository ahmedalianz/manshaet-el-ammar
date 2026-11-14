# Add Service Stitch refresh

References: Stitch project 2475157814755974565, screens 060b935e604b471caaa1cf299833fa4a (step one), c9359e2eeed845cf99087933bf21e12a (step two), a95d549796f74a189862383677ee1824 (introduction).

Updated the introduction with a centered handshake hero, location badge, two benefit cards, review notice, primary start action and secondary exit. Restyled the existing two-step form with an accessible progress indicator, welcome panel, description counter, free-submission review notice, and separate contact/location panels. Used existing Petroleum Blue theme tokens, typography, motion, inputs and route/auth logic.

Adaptations: Arabic screen titles; address-only input retained per earlier instruction. No map picker, draft persistence or service-quality certification was added. Description limit remains 2000, matching existing validation. Explicit consent, submission validation, retry handling, unsaved-change protection, category data and quota enforcement remain intact. Shared form styling also applies to editing an existing service.

Automated: TypeScript and lint passed. Earlier full suite: 39 suites / 355 tests passed. Latest full suite after concurrent My Services work: 39 suites passed, 1 failed; 356 tests passed, 5 failed, all failures in my-services-design.test.tsx. Focused Add Service tests passed. Added introduction routing tests and form progress/section checks. No production submissions or Firebase changes made.

Manual: inspected the introduction in Android Light mode, including scrolling to both bottom actions. Evidence: evidence/add-service-stitch-intro.png and evidence/add-service-stitch-intro-actions.png. Authenticated form steps, keyboard layout, Dark mode, and large-text variants were not manually inspected in this session.
