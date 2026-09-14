# PostHog Raw Extraction
**Retrieved at:** 2026-05-27T12:36:58.758Z
Official docs were fetched from PostHog raw Markdown endpoints listed in `llms.txt`. Each block keeps short body excerpts for validator proof, not full-page reproduction.

## URL: https://posthog.com/llms.txt

**Status:** read 200

**SHA-256:** 3370397a136463a50af69f5c663aee0039e1cfd9126ddc8c60726cdbe55dd6c7

**Body text (verbatim):**
> "> PostHog is an open-source product and data tools platform. It provides product analytics, session replay, feature flags, A/B testing, error tracking, surveys, LLM observability, web analytics, data warehouse, and more "
> "PostHog can be added to any web, mobile, or backend application. All docs pages below are available as raw Markdown by appending `.md` to any URL."

**Extraction note:** Read as part of CAPABILITIES.md, details/platform-products-and-costs.md.

## URL: https://posthog.com/docs/libraries.md

**Status:** read 200

**SHA-256:** 3caccaa5ab72e89ab33ab26111b3d1b742806c5639c72b135044c2dee3b218ff

**Body text (verbatim):**
> "PostHog provides a number of both official and community maintained libraries to help you easily integrate with your preferred language or framework."
> "This document outlines all of our current client-side and server-side libraries, as well as which features each of them currently supports."

**Extraction note:** Read as part of details/browser-react-sdk.md.

## URL: https://posthog.com/docs/libraries/js.md

**Status:** read 200

**SHA-256:** c528120483b03c7faa6010c2841d8482dd65ebf5150a4184625c3e4b472604de

**Body text (verbatim):**
> "> **Note:** This doc refers to our [posthog-js](https://github.com/PostHog/posthog-js) library for use on the browser. For server-side JavaScript, see our [Node SDK](/docs/libraries/node.md)."
> "Option 1: Add the JavaScript snippet to your HTML Recommended"

**Extraction note:** Read as part of details/browser-react-sdk.md.

## URL: https://posthog.com/docs/libraries/js/config.md

**Status:** read 200

**SHA-256:** da77c784b44d6c71552c7d07942e4ce32c05201327edaf90d8dbbe2694834e3f

**Body text (verbatim):**
> "When calling `posthog.init`, there are various configuration options you can set to customize and control the behavior of PostHog."
> "Use this interactive builder to generate your `posthog.init` configuration. Select the options you need and copy the generated code."

**Extraction note:** Read as part of details/browser-react-sdk.md, details/consent-privacy-and-gdpr.md.

## URL: https://posthog.com/docs/libraries/js/persistence.md

**Status:** read 200

**SHA-256:** fe41de4f3e26bc1c1801dff3910930e0dba522687d4605c1cb388932bebcc9b1

**Body text (verbatim):**
> "For PostHog to work optimally, we store a small amount of information about the user on the user's browser. This ensures we identify users properly if they navigate away from your site and come back later."
> "Some PostHog configuration options (e.g. whether session recording is enabled)"

**Extraction note:** Read as part of details/consent-privacy-and-gdpr.md.

## URL: https://posthog.com/docs/libraries/js/usage.md

**Status:** read 200

**SHA-256:** a80daf485e9808c9642ab6fd711ca59c6efd296558a0d62d99de18db79ac896c

**Body text (verbatim):**
> "By default, PostHog automatically captures pageviews and pageleaves as well as clicks, change of inputs, and form submissions associated with `a`, `button`, `form`, `input`, `select`, `textarea`, and `label` tags. See ou"
> "If you prefer to disable or filter these, set the appropriate values in your [configuration options](/docs/libraries/js/config.md)."

**Extraction note:** Read as part of details/browser-react-sdk.md, details/event-model-identity-and-persons.md.

## URL: https://posthog.com/docs/libraries/react.md

**Status:** read 200

**SHA-256:** 9e2f7d5fc10fdfc868c0c28802274b291d16b63dfd2c77ddc02b37d9cd654523

**Body text (verbatim):**
> "PostHog makes it easy to get data about traffic and usage of your React app. Integrating PostHog into your site enables analytics about user behavior, custom events capture, session recordings, feature flags, and more."
> "This guide walks you through an example integration of PostHog using vanilla React and the [posthog-js library](/docs/integrate/client/js.md)."

**Extraction note:** Read as part of details/browser-react-sdk.md.

## URL: https://posthog.com/docs/libraries/node.md

**Status:** read 200

**SHA-256:** c895808333fa18fbef3d93fa9d6c54cacd3ee115d45cceb1527d4610e8e6b6ec

**Body text (verbatim):**
> "If you're working with Node.js (versions 20+), the official `posthog-node` library is the simplest way to integrate your software with PostHog. This library uses an internal queue to make calls fast and non-blocking. It "
> "Run either `npm` or `yarn` in terminal to add it to your project:"

**Extraction note:** Read as part of details/server-api-mcp-and-verification.md.

## URL: https://posthog.com/docs/support/javascript-api.md

**Status:** read 200

**SHA-256:** 9b4c797669649cf4bceea4c2d236c238d819a8ac1682013af464771798e45cb8

**Body text (verbatim):**
> "The JavaScript API at `posthog.conversations` gives you full programmatic control over support conversations. Use it to build custom support interfaces or integrate support into your existing UI."
> "Before using the API, check if conversations are available:"

**Extraction note:** Read as part of details/browser-react-sdk.md.

## URL: https://posthog.com/docs/api.md

**Status:** read 200

**SHA-256:** 62e9360d82573522d8b17c88b9a2217acb89a5b7991333d4ab562ad1d9f178f1

**Body text (verbatim):**
> "PostHog has a powerful API that enables you to capture, evaluate, create, update, and delete nearly all of your information in PostHog. You can use it to [pull information into your app](/tutorials/embedded-analytics.md)"
> "The API is available for all users and instances. It contains two types of endpoints:"

**Extraction note:** Read as part of details/server-api-mcp-and-verification.md.

## URL: https://posthog.com/docs/api/capture.md

**Status:** read 200

**SHA-256:** abadf7b894dc4c4578f15391144a815a16703fc9afc2884484bb7abc8638d9ee

**Body text (verbatim):**
> "The `/i/v0/e` and `/batch` endpoints are the main way to send events to PostHog. Beyond user behavior, they are also used to identify users, update person or group properties, migrate from other platforms, and more. [Our"
> "Both are POST-only public endpoints that use your [project token](https://app.posthog.com/project/settings) and do not return any sensitive data from your PostHog instance."

**Extraction note:** Read as part of details/server-api-mcp-and-verification.md.

## URL: https://posthog.com/docs/api/flags.md

**Status:** read 200

**SHA-256:** 1908b97480be81d2b499be5df4ac5bdffa7524c090822042d492971bba796c69

**Body text (verbatim):**
> "Flags – the feature flags evaluation API endpoint - Docs"
> "The `flags` endpoint is used to evaluate feature flags for a given `distinct_id`. This means it is the main endpoint not only for feature flags, but also experimentation, early access features, and survey display conditi"

**Extraction note:** Read as part of details/server-api-mcp-and-verification.md, details/feature-flags-experiments-and-rollouts.md.

## URL: https://posthog.com/docs/data/events.md

**Status:** read 200

**SHA-256:** daa06bc6acbfe7a0b5ac72009c83a7c08a3fa4a9a42c58c444b8bd84ea7c5ffb

**Body text (verbatim):**
> "An event is the core unit of data in PostHog. It represents an interaction a user has with your app or website. Examples include button clicks, pageviews, query completions, and signups."
> "1.  An `event` name like `$pageview` or `query completed`. Events starting with `$` are PostHog defaults."

**Extraction note:** Read as part of details/event-model-identity-and-persons.md.

## URL: https://posthog.com/docs/data/persons.md

**Status:** read 200

**SHA-256:** 1008855a4890f4a5a2462766bb1f9b9cb4d4259375dd5465fa80926cf60f3ec8

**Body text (verbatim):**
> "People in PostHog represent the users behind your events. You can view them in the [People tab](https://app.posthog.com/persons)."
> "People have **person profiles** with [properties](/docs/product-analytics/person-properties.md). This enables you to do things like:"

**Extraction note:** Read as part of details/event-model-identity-and-persons.md.

## URL: https://posthog.com/docs/data/anonymous-vs-identified-events.md

**Status:** read 200

**SHA-256:** 05d0186a0618f0a0702520bd8584abb649af4bbcb27d29dc7b43cbc68ef56256

**Body text (verbatim):**
> "PostHog captures two types of events: [**anonymous** and **identified**](/docs/data/anonymous-vs-identified-events.md)"
> "**Identified events** enable you to attribute events to specific users, and attach [person properties](/docs/product-analytics/person-properties.md). They're best suited for logged-in users."

**Extraction note:** Read as part of details/event-model-identity-and-persons.md.

## URL: https://posthog.com/docs/product-analytics/installation.md

**Status:** read 200

**SHA-256:** f95c8ee9a41fdb391a2d7ec705c1018220f7c7636137e40b025fa5819f801346

**Body text (verbatim):**
> "Install PostHog in seconds with our wizard by running this command in your project directory with your terminal (it also works for [LLM coding agents](/blog/envoy-wizard-llm-agent.md) like Cursor and Bolt):"
> "Wait for it to finish and test the setup once the wizard is complete."

**Extraction note:** Read as part of details/event-model-identity-and-persons.md.

## URL: https://posthog.com/docs/product-analytics/capture-events.md

**Status:** read 200

**SHA-256:** 6a57af2666abd8f8f36c3cdbf0a9a7cf6864450d2503c0e9937f71b2484d4f7a

**Body text (verbatim):**
> "Once your PostHog instance is up and running, the next step is to start sending events."
> "By default, PostHog automatically captures pageviews and pageleaves as well as clicks, change of inputs, and form submissions associated with `a`, `button`, `form`, `input`, `select`, `textarea`, and `label` tags. See ou"

**Extraction note:** Read as part of details/event-model-identity-and-persons.md.

## URL: https://posthog.com/docs/product-analytics/identify.md

**Status:** read 200

**SHA-256:** 684851d74cb23faa006d55a9020d4677cf79711a0a94dbf4358bf41a2f52b074

**Body text (verbatim):**
> "This page is the API reference for `identify()` – when to call it, what it does, and how to use it across SDKs. For the broader identity strategy (how to design your anonymous-to-identified flow, cross-platform consisten"
> "Linking events to specific users enables you to build a full picture of how they're using your product across different sessions, devices, and platforms."

**Extraction note:** Read as part of details/event-model-identity-and-persons.md.

## URL: https://posthog.com/docs/product-analytics/identity-resolution.md

**Status:** read 200

**SHA-256:** b5771abce9cea28a0c62e35aef00ba4874deec153995e244f221837deeca6df5

**Body text (verbatim):**
> "[Identity resolution is your engineering problem](#identity-resolution-is-your-engineering-problem) – PostHog consumes what you give it. If your identity data is incoherent, every downstream feature inherits that incoher"
> "[Think in layers](#the-identity-layer-model) – stable IDs, authentication IDs, and device IDs serve different purposes. Know which layer you're operating at."

**Extraction note:** Read as part of details/event-model-identity-and-persons.md.

## URL: https://posthog.com/docs/product-analytics/person-properties.md

**Status:** read 200

**SHA-256:** 5b95e27c76d8e1f0a03484737b2cc50ed09d2955c5985da6952b30dc8495040a

**Body text (verbatim):**
> "Person properties enable you to capture, manage, and analyze specific data about a user. You can use them to create [filters](/docs/product-analytics/trends.md#filtering-events-based-on-properties) or [cohorts](/docs/dat"
> "Person properties are stored on [person profiles](/docs/data/persons.md). When setting properties, a person profile is created if it doesn't already exist."

**Extraction note:** Read as part of details/event-model-identity-and-persons.md.

## URL: https://posthog.com/docs/product-analytics/privacy.md

**Status:** read 200

**SHA-256:** 3c2969465d21b33e3021a88e8eb27ba8309416904f961d446a966196f8333443

**Body text (verbatim):**
> "PostHog offers a range of controls to limit what data is captured by product analytics. They are listed below in order of least to most restrictive."
> "PostHog offers hosting on EU cloud. To use this, sign up at [eu.posthog.com](https://eu.posthog.com)."

**Extraction note:** Read as part of details/consent-privacy-and-gdpr.md.

## URL: https://posthog.com/docs/product-analytics/autocapture.md

**Status:** read 200

**SHA-256:** b1f0c28a36a25a85ed4ba2f51902a97768f112b754eff210056510d6e86b3f52

**Body text (verbatim):**
> "PostHog can automatically capture a variety of events in your app without specific tracking code. This page covers the different types of events that PostHog can capture and how to configure them."
> "PostHog can automatically capture these types of data without specific tracking code:"

**Extraction note:** Read as part of details/browser-react-sdk.md, details/consent-privacy-and-gdpr.md.

## URL: https://posthog.com/docs/feature-flags/start-here.md

**Status:** read 200

**SHA-256:** 089d04537ef05ef60cf56265e609df69317acdb1ce501645682beb3897d99db1

**Body text (verbatim):**
> "A feature flag lets you toggle a feature on or off without redeploying code. To get started, install the PostHog SDK for your platform and create your first flag in the PostHog UI."
> "[![](https://res.cloudinary.com/dmukukwp6/image/upload/posthog.com/contents/images/docs/integrate/js.svg)Web](/docs/feature-flags/installation/web.md)"

**Extraction note:** Read as part of details/feature-flags-experiments-and-rollouts.md.

## URL: https://posthog.com/docs/feature-flags/adding-feature-flag-code.md

**Status:** read 200

**SHA-256:** 164aab905cd92c4bf18fe0debdfe60852f05ff4bde34bd765f8b00f35a199f32

**Body text (verbatim):**
> "Once you've created your feature flag in PostHog, the next step is to add your code:"
> "Every time a user loads a page, we send a request in the background to fetch the feature flags that apply to that user. We store those flags in your chosen persistence option (local storage by default)."

**Extraction note:** Read as part of details/feature-flags-experiments-and-rollouts.md.

## URL: https://posthog.com/docs/feature-flags/bootstrapping.md

**Status:** read 200

**SHA-256:** 9bdc12f28eb9ecb31bef628827a533a916b45d4bc6da2f41a6eff60b594be178

**Body text (verbatim):**
> "> **Note:** Bootstrapping feature flags is only available in our [JavaScript web](/docs/libraries/js.md) and [React Native](/docs/libraries/react-native.md) SDKs."
> "Since there is a delay between initializing PostHog and fetching feature flags, feature flags are not always available immediately. This makes them unusable if you want to do something like redirecting a user to a differ"

**Extraction note:** Read as part of details/feature-flags-experiments-and-rollouts.md.

## URL: https://posthog.com/docs/feature-flags/local-evaluation.md

**Status:** read 200

**SHA-256:** 2d9a795773f86d760d23d8ed25eb7035bc56a11d0bc593104904e25216eec26c

**Body text (verbatim):**
> "> **Note:** Local evaluation is only available in the [Node](/docs/libraries/node.md), [Ruby](/docs/libraries/ruby.md), [Go](/docs/libraries/go.md), [Python](/docs/libraries/python.md), [C#/.NET](/docs/libraries/dotnet.m"
> "> **Note:** In edge/lambda environments and stateless PHP applications, local evaluation with the default in-memory cache causes performance issues and inflated costs due to per-request initialization. For these environm"

**Extraction note:** Read as part of details/feature-flags-experiments-and-rollouts.md.

## URL: https://posthog.com/docs/feature-flags/canary-release.md

**Status:** read 200

**SHA-256:** 767c4a9c762a8d734287926b5303f673633bc0f70250ee21ac902e8aff0f3fb6

**Body text (verbatim):**
> "Few things are worse than shipping a new feature, having it unexpectedly break, and then scrambling to fix it. To mitigate problems like this, teams often roll out changes to a subset of users before releasing them to ev"
> "This tutorial explains what a canary release is, and how to set one up and monitor it in PostHog."

**Extraction note:** Read as part of details/feature-flags-experiments-and-rollouts.md.

## URL: https://posthog.com/docs/experiments/start-here.md

**Status:** read 200

**SHA-256:** 4dc3a6a968599ac29b69ad21a97ce4240a2a6f60d09bbddbfb691202fc9217ca

**Body text (verbatim):**
> "Experiments enable you to test the impact of product changes and understand how they affect your users' behavior. For example, testing different onboarding flows, app designs, or pricing strategies."
> "The first step is to install PostHog with the library you want to run experiments in:"

**Extraction note:** Read as part of details/feature-flags-experiments-and-rollouts.md.

## URL: https://posthog.com/docs/experiments/adding-experiment-code.md

**Status:** read 200

**SHA-256:** 96a4910b5d92c7230d946d8f58dba8e69c2e448acbfd4cd0956a3a0e955144bd

**Body text (verbatim):**
> "Once you've created your experiment in PostHog, the next step is to add your code."
> "In your experiment, each user is randomly assigned to a variant (usually either 'control' or 'test'). To check which variant a user has been assigned to, fetch the experiment feature flag. You can then customize their ex"

**Extraction note:** Read as part of details/feature-flags-experiments-and-rollouts.md.

## URL: https://posthog.com/docs/experiments/exposures.md

**Status:** read 200

**SHA-256:** ebf02e0f825f43ac200e9b5e2b0aa0056b49ad431f2ceffa4853b4e7357af966

**Body text (verbatim):**
> "Exposures are the foundation of experiment analysis in PostHog. A user must be **exposed** to your experiment before they can be included in any metric calculations. Understanding how exposures work is crucial for runnin"
> "An exposure occurs when a user encounters the part of your product where the experiment is running. This is the moment they become a participant in your experiment and start contributing to your metrics."

**Extraction note:** Read as part of details/feature-flags-experiments-and-rollouts.md.

## URL: https://posthog.com/docs/session-replay/start-here.md

**Status:** read 200

**SHA-256:** d3681e7f4c8a625390085682f7b938654c7a0203ce4ad10f11fc39f7f1b24980

**Body text (verbatim):**
> "Install the PostHog SDK and enable [Session Replay](/docs/session-replay.md) with a couple lines of config."
> "PostHog automatically captures every click, scroll, input, and page view. Session recording starts the moment a user lands on your page."

**Extraction note:** Read as part of details/session-replay-error-surveys-web-analytics.md.

## URL: https://posthog.com/docs/session-replay/privacy.md

**Status:** read 200

**SHA-256:** 6d61a29c7227a7fa6f47355d21c3c339055df27ea4015b7aa1999b2008294cef

**Body text (verbatim):**
> "PostHog offers a range of controls to limit what data is captured by session recordings. Our privacy controls run in the browser or mobile app. So, masked data is never sent over the network to PostHog."
> "As any input element is highly likely to contain sensitive text such as email or password, **we mask these by default**. You can explicitly set this to false to disable the masking. You can then specify inputs types you "

**Extraction note:** Read as part of details/session-replay-error-surveys-web-analytics.md, details/consent-privacy-and-gdpr.md.

## URL: https://posthog.com/docs/session-replay/console-log-recording.md

**Status:** read 200

**SHA-256:** e3de26c5e0fda6671d42bf84ea522b2baa2f785e71e87970ab741155ca7ecaf5

**Body text (verbatim):**
> "PostHog can capture console logs, info, warnings, and errors from your application. This is useful for debugging and providing extra context on what is happening in your user's browser or mobile device environment."
> "As console logs can contain sensitive information, we do not capture these logs automatically. You can enable this feature globally *either* from your [project settings](https://us.posthog.com/settings/project-replay#rep"

**Extraction note:** Read as part of details/session-replay-error-surveys-web-analytics.md.

## URL: https://posthog.com/docs/error-tracking/capture.md

**Status:** read 200

**SHA-256:** c4d4dae1c8df47eea570afeb339eff12ae3827dba1f3f869cff47199cbb4d70e

**Body text (verbatim):**
> "You can track and monitor errors and exceptions in your code by capturing [exception events](/docs/error-tracking/issues-and-exceptions.md). This can be done automatically when exceptions are thrown in your code, or manu"
> "Exceptions are a special type of [event](/docs/data/events.md) in PostHog. Similar to any other event, they can be captured, customized, filtered, and used in insights for analysis."

**Extraction note:** Read as part of details/session-replay-error-surveys-web-analytics.md.

## URL: https://posthog.com/docs/surveys/creating-surveys.md

**Status:** read 200

**SHA-256:** 835b7fa071090be4ac16df50b4b85267e9a495099b349ea99a749b4aac89cacb

**Body text (verbatim):**
> "To create a new survey, go to the [surveys tab](https://app.posthog.com/surveys) in the PostHog app, and click on the **New survey** button in the top right. This opens the survey wizard where you can choose from popular"
> "After choosing a template, you are brought to a form where you can complete the details of your new survey:"

**Extraction note:** Read as part of details/session-replay-error-surveys-web-analytics.md.

## URL: https://posthog.com/docs/web-analytics/installation.md

**Status:** read 200

**SHA-256:** 3261906dd5ec2a49b084639870f4d6322f4b0d66d8358c76f8d459bbc8e784be

**Body text (verbatim):**
> "Install PostHog in minutes with our wizard by running this command in your project directory:"
> "Wait for it to finish and test the setup once the wizard is complete."

**Extraction note:** Read as part of details/session-replay-error-surveys-web-analytics.md.

## URL: https://posthog.com/docs/privacy.md

**Status:** read 200

**SHA-256:** b1c2e1e11365c9cdd3c3197452cd5f0b57462c75824a76d2abd9de3001cc5f78

**Body text (verbatim):**
> "Posthog gives you privacy controls at different levels to protect user privacy and comply with regulations. This guide covers the different privacy controls we provide and guidance on how to use them."
> "**What you're responsible for**: It's your responsibility to decide what data you collect, if it complies with regulations, and communicate with your users."

**Extraction note:** Read as part of details/consent-privacy-and-gdpr.md.

## URL: https://posthog.com/docs/privacy/gdpr-compliance.md

**Status:** read 200

**SHA-256:** 1189f68748ae8fef8e7d1a3584c1fdd5cedc66e6737a20c7c69db6b4eb697851

**Body text (verbatim):**
> "The [General Data Protection Regulation (GDPR)](https://gdpr.eu/) is a privacy and security law, drafted and passed by the European Union (EU). It imposes obligations onto organizations anywhere, so long as they target o"
> "We recommend that you read the full text of the GDPR and seek independent legal advice regarding your obligations. The consequences of violating GDPR are severe."

**Extraction note:** Read as part of details/consent-privacy-and-gdpr.md.

## URL: https://posthog.com/docs/privacy/data-collection.md

**Status:** read 200

**SHA-256:** af9811cf0091643c20f7203af2e51f34b56666e92b9840e1790e90c5485d0c6a

**Body text (verbatim):**
> "PostHog offers a range of controls to help you manage data collection. This guide covers data collection controls available to you **before** data reaches PostHog servers."
> "You should consider the following tools to help you manage data collection:"

**Extraction note:** Read as part of details/consent-privacy-and-gdpr.md.

## URL: https://posthog.com/docs/privacy/data-storage.md

**Status:** read 200

**SHA-256:** 13463b324cbaaad2cf490a7bb8e79b4ce599d13ffcaf33dd90473438edb6fbf4

**Body text (verbatim):**
> "This guide covers the various features available **after data reaches PostHog Cloud servers** to help you achieve your privacy goals. If you have data that cannot reach a third-party server like PostHog, please omit them"
> "| [Data storage location](#data-storage-location) | Control where your data is physically stored for GDPR compliance |"

**Extraction note:** Read as part of details/consent-privacy-and-gdpr.md.

## URL: https://posthog.com/docs/privacy/ad-blockers.md

**Status:** read 200

**SHA-256:** 5805698007426723b5ff9a57a70ed88ab0eb035fd09ef57b829959880db8c489

**Body text (verbatim):**
> "PostHog provides a range of services that help teams build great products."
> "Part of that range are web and product analytics, which send usage event reporting back to PostHog. We encourage our customers to be transparent about this reporting, provide several [privacy-preserving options](/docs/pr"

**Extraction note:** Read as part of details/consent-privacy-and-gdpr.md.

## URL: https://posthog.com/docs/advanced/content-security-policy.md

**Status:** read 200

**SHA-256:** 087b9b1e54f626b19a74b501c42e5d06ab18e61c97df206159fcede91f9c9ca2

**Body text (verbatim):**
> "As [described on MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP): *Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks, including Cross-Site "
> "If you choose to use a CSP it is important to ensure that PostHog domains are permitted. PostHog is a distributed Cloud service and as such can have different domains that change over time but will always be served from "

**Extraction note:** Read as part of details/server-api-mcp-and-verification.md.

## URL: https://posthog.com/docs/advanced/proxy.md

**Status:** read 200

**SHA-256:** add9b7d6a1d1c262387a16a5b268f7e41b2cfee754adf05a63018b6effa90b1a

**Body text (verbatim):**
> "A reverse proxy helps you capture more complete usage data. Ad blockers maintain lists of known analytics domains and block requests to them. A reverse proxy bypasses this by routing events through your own domain, which"
> "A reverse proxy sends events to PostHog through your own subdomain (like `e.yourdomain.com`) instead of directly to PostHog's domain."

**Extraction note:** Read as part of details/server-api-mcp-and-verification.md.

## URL: https://posthog.com/docs/model-context-protocol.md

**Status:** read 200

**SHA-256:** 0cdbe77873f82ffa3d4d136bab18e4dec2701f7a75856ce3915e4105db635d54

**Body text (verbatim):**
> "The PostHog [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server is a free, hosted endpoint that lets your AI agent use PostHog – with just plain text questions your agents can ship a featu"
> "It works with any MCP-compatible client, including [PostHog Code](/code.md), Claude Code, Claude Desktop, Cursor, Codex, VS Code, Windsurf, and Zed."

**Extraction note:** Read as part of details/server-api-mcp-and-verification.md.

## URL: https://posthog.com/docs/model-context-protocol/tools.md

**Status:** read 200

**SHA-256:** deae318d0bce0a35cf162ea772298fa47df081663460d5cdca6081a2095ddaf2

**Body text (verbatim):**
> "The PostHog MCP server exposes function-calling tools across every PostHog product – from feature flags and experiments to error tracking, logs, surveys, and SQL. Your agent picks the right tool based on the goals and co"
> "Tool names are stable and can be used with the [`tools` query parameter](/docs/model-context-protocol/faq.md#filtering-available-tools) to scope a session to a specific subset."

**Extraction note:** Read as part of details/server-api-mcp-and-verification.md.

## URL: https://posthog.com/docs/model-context-protocol/codex.md

**Status:** read 200

**SHA-256:** 9492bed136d893923c09d4aa4ecad8f3cfaf3e9de38cd7d15c94d3da58574d76

**Body text (verbatim):**
> "The PostHog [MCP server](https://modelcontextprotocol.io/introduction) enables Codex to directly interact with your PostHog data – managing feature flags, querying analytics, investigating errors, and more."
> "The PostHog authentication server automatically routes you to the correct data region (US or EU) based on the account you log in with."

**Extraction note:** Read as part of details/server-api-mcp-and-verification.md.

## URL: https://posthog.com/docs/model-context-protocol/claude-code.md

**Status:** read 200

**SHA-256:** 3ee45a02ad66e5ec8745463001bfa04f88f0e01a29db70476bfecad5528c6239

**Body text (verbatim):**
> "The PostHog [MCP server](https://modelcontextprotocol.io/introduction) enables Claude Code to directly interact with your PostHog data – managing feature flags, querying analytics, investigating errors, and more."
> "The PostHog authentication server automatically routes you to the correct data region (US or EU) based on the account you log in with."

**Extraction note:** Read as part of details/server-api-mcp-and-verification.md.

## URL: https://posthog.com/docs/model-context-protocol/faq.md

**Status:** read 200

**SHA-256:** eaf4c31db17a01b02dcfeb23d003830a461f3108b03346c5485a41f122d611f7

**Body text (verbatim):**
> "Everything you need to know about authentication, scoping, filtering, safety, and billing for the PostHog MCP server. If you're just getting started, head to the [overview](/docs/model-context-protocol.md) or the [use ca"
> "> Be mindful of prompt injection – LLMs can be tricked into following untrusted commands, so always review tool calls before executing them."

**Extraction note:** Read as part of details/server-api-mcp-and-verification.md.

## URL: https://posthog.com/docs/sdk-doctor/keeping-sdks-current.md

**Status:** read 200

**SHA-256:** 0a88bce89e4e85eeb2977a049a7019000322d1e2525835a5d92ef67cb15f3504

**Body text (verbatim):**
> "[SDK doctor](/docs/sdk-doctor.md) identifies when your PostHog SDKs are outdated, but understanding why they fall behind, and how to prevent it, helps avoid the problem in the first place."
> "The [HTML snippet](/docs/web-analytics/installation/html-snippet.md) loads `posthog-js` directly from our CDN. When a new version is released, visitors to your site should get the latest version automatically."

**Extraction note:** Read as part of details/browser-react-sdk.md.

## URL: https://registry.npmjs.org/posthog-js/latest

**Status:** read 200

**SHA-256:** 7ff4fb2ec7ba4a41bca03e1a0bcaf895d95c77ca92971981e27f2826aa3380f0

**Body text (verbatim):**
> "{'name':'posthog-js','version':'1.376.2','description':'Posthog-js allows you to automatically capture usage and send events to PostHog.','repository':{'type':'git','url':'git+https://github.com/PostHog/posthog-js.git'},"
> "{'name':'posthog-js','version':'1.376.2','description':'Posthog-js allows you to automatically capture usage and send events to PostHog.','repository':{'type':'git','url':'git+https://github.com/PostHog/posthog-js.git'},"

**Extraction note:** Read as part of details/browser-react-sdk.md, details/platform-products-and-costs.md.

## URL: https://registry.npmjs.org/@posthog/react/latest

**Status:** read 200

**SHA-256:** 260e89bacf8cfd087bf7fe650579cfe99829535ceec4929cb56f19e140abca45

**Body text (verbatim):**
> "@posthog/react package metadata from npm registry."
> "Peer dependencies include posthog-js and react."

**Extraction note:** Read as part of details/browser-react-sdk.md.
