/**
 * Exam facts for LPI Linux Essentials 010-200 (objectives v2.0). The topics and
 * objectives arrive in phase 1 (PLAN.md §8); until then this holds the format.
 */

export const SOURCES = {
  objectivesUrl: 'https://www.lpi.org/our-certifications/exam-010-objectives/',
  overviewUrl: 'https://www.lpi.org/our-certifications/linux-essentials-overview/',
  changesUrl: 'https://wiki.lpi.org/wiki/Linux_Essentials_Summary_Version_1.6_To_2.0',
  faqUrl: 'https://www.lpi.org/about-lpi/frequently-asked-questions/',
  pricingUrl: 'https://www.lpi.org/exam-pricing/',
  learningMaterialsUrl: 'https://learning.lpi.org/en/learning-materials/010-200/',
  objectivesVersion: '2.0',
  examCode: '010-200',
} as const

/**
 * Checked 2026-11-24.
 * - items, minutes: overview and objectives pages.
 * - scale and pass mark: the LPI FAQ ("Each LPI exam is ranked on a scale from
 *   200 to 800, with a passing score of 500"). The cut is set psychometrically,
 *   so the app's scaled score is always labelled an estimate.
 * - formats: no official LPI page lists them. An LPI-hosted trainer post
 *   (https://www.lpi.org/blog/2026/02/12/how-i-scored-100-on-the-linux-essentials-exam/)
 *   says "multiple choice, multiple response, and short input", about 010-160.
 */
export const EXAM_FORMAT = {
  items: 40,
  minutes: 60,
  scaleMin: 200,
  scaleMax: 800,
  passScore: 500,
  formats: ['multiple choice', 'multiple response', 'short input'],
  previousExam: { code: '010-160', version: '1.6', availableUntil: 'April 2027' },
} as const
