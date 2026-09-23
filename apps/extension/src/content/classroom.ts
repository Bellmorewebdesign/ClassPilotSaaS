import { parseClassroomUrl } from '@classpilot/shared';
import { captureStructure } from '../extractors/diagnostics.js';
import { extractAssignmentPage } from '../extractors/assignmentPage.js';
import { extractClassPage } from '../extractors/classPage.js';
import { extractClassroomHome } from '../extractors/classroomHome.js';
import { extractClassworkPage } from '../extractors/classworkPage.js';
import { extractStreamPage } from '../extractors/streamPage.js';
import { awaitReady } from '../extractors/readiness.js';
import type { ContentRequest, ContentResponse } from '../lib/messages.js';

/**
 * Content script, injected on classroom.google.com by the manifest.
 *
 * It answers two kinds of request from the background worker, against
 * whatever is currently rendered: "is this page extractable yet" and
 * "extract it". It never navigates, never clicks, never posts anywhere, and
 * holds no state.
 *
 * Readiness lives here rather than in the worker because the extractors live
 * here. Only this context can see the DOM, and only the extractors know what
 * state they need it to be in.
 *
 * Why a declared content script plus messaging, rather than
 * chrome.scripting.executeScript at sync time: executeScript's return value
 * is the last-evaluated expression of the injected file, which is fragile
 * with a bundled IIFE. Messaging gives a typed request/response with no
 * reliance on bundler output shape.
 */

/**
 * Requests answered asynchronously.
 *
 * chrome.runtime.onMessage needs to know up-front whether the response
 * channel stays open, so the async set is declared rather than inferred.
 */
function isAsync(request: ContentRequest): boolean {
  return request.type === 'AWAIT_READY';
}

async function handleAsync(request: ContentRequest): Promise<ContentResponse> {
  if (request.type !== 'AWAIT_READY') {
    throw new Error(`handleAsync received a synchronous request: ${request.type}`);
  }
  const readiness = await awaitReady(
    document,
    () => window.location.href,
    request.target,
    request.timeoutMs === undefined ? {} : { timeoutMs: request.timeoutMs },
  );
  return { ok: true, type: 'READY', readiness };
}

function handle(request: ContentRequest): ContentResponse {
  const context = {
    document,
    url: window.location.href,
    now: new Date(),
  };

  switch (request.type) {
    case 'AWAIT_READY':
      // Handled by handleAsync; unreachable.
      throw new Error('AWAIT_READY must be handled asynchronously');

    case 'PING':
      return {
        ok: true,
        type: 'PONG',
        url: window.location.href,
        readyState: document.readyState,
      };

    case 'EXTRACT_HOME': {
      const { result } = extractClassroomHome(context);
      return {
        ok: true,
        type: 'HOME',
        classes: result.classes,
        looksSignedIn: result.looksSignedIn,
      };
    }

    case 'EXTRACT_CLASS': {
      const { candidate, failureReason } = extractClassPage(context);
      if (!candidate) {
        return { ok: false, code: failureReason ?? 'class_extract_failed', error: 'Could not read this class page.' };
      }
      return { ok: true, type: 'CLASS', klass: candidate };
    }

    case 'EXTRACT_CLASSWORK': {
      const { result } = extractClassworkPage(context);
      return { ok: true, type: 'CLASSWORK', page: result };
    }

    case 'EXTRACT_STREAM': {
      const { result } = extractStreamPage(context);
      return { ok: true, type: 'STREAM', page: result };
    }

    case 'EXTRACT_ASSIGNMENT': {
      const { candidate, failureReason } = extractAssignmentPage(context);
      if (!candidate) {
        return {
          ok: false,
          code: failureReason ?? 'assignment_extract_failed',
          error: 'Could not read this assignment page.',
        };
      }
      return { ok: true, type: 'ASSIGNMENT', assignment: candidate };
    }

    case 'CAPTURE_STRUCTURE':
      return {
        ok: true,
        type: 'STRUCTURE',
        report: captureStructure(document, window.location.href, {
          includeText: request.includeText,
        }),
      };
  }
}

chrome.runtime.onMessage.addListener(
  (request: ContentRequest, _sender, sendResponse: (response: ContentResponse) => void) => {
    const fail = (error: unknown): void =>
      sendResponse({
        ok: false,
        code: 'content_script_error',
        error: error instanceof Error ? error.message : 'Unknown content script error',
      });

    if (isAsync(request)) {
      // Returning true keeps the response channel open. awaitReady always
      // resolves (a timeout is a result), so the channel is always closed.
      handleAsync(request).then(sendResponse, fail);
      return true;
    }

    try {
      sendResponse(handle(request));
    } catch (error) {
      // An extractor bug must never take the page down or hang the sync.
      fail(error);
    }
    // Synchronous response; no need to keep the channel open.
    return false;
  },
);

/**
 * Tell the background worker we are alive on a Classroom page. This is what
 * lets the popup show "Classroom detected" without polling.
 */
if (parseClassroomUrl(window.location.href).isClassroom) {
  chrome.runtime
    .sendMessage({ type: 'CONTENT_READY', url: window.location.href })
    .catch(() => {
      // The worker may be asleep; it will find us via PING when it needs us.
    });
}
