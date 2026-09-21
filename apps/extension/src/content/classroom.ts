import { parseClassroomUrl } from '@classpilot/shared';
import { captureStructure } from '../extractors/diagnostics.js';
import { extractAssignmentPage } from '../extractors/assignmentPage.js';
import { extractClassPage } from '../extractors/classPage.js';
import { extractClassroomHome } from '../extractors/classroomHome.js';
import { extractClassworkPage } from '../extractors/classworkPage.js';
import type { ContentRequest, ContentResponse } from '../lib/messages.js';

/**
 * Content script, injected on classroom.google.com by the manifest.
 *
 * It does exactly one thing: answer extraction requests from the background
 * worker against whatever is currently rendered. It never navigates, never
 * clicks, never posts anywhere, and holds no state.
 *
 * Why a declared content script plus messaging, rather than
 * chrome.scripting.executeScript at sync time: executeScript's return value
 * is the last-evaluated expression of the injected file, which is fragile
 * with a bundled IIFE. Messaging gives a typed request/response with no
 * reliance on bundler output shape.
 */

function handle(request: ContentRequest): ContentResponse {
  const context = {
    document,
    url: window.location.href,
    now: new Date(),
  };

  switch (request.type) {
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
    try {
      sendResponse(handle(request));
    } catch (error) {
      // An extractor bug must never take the page down or hang the sync.
      sendResponse({
        ok: false,
        code: 'content_script_error',
        error: error instanceof Error ? error.message : 'Unknown content script error',
      });
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
