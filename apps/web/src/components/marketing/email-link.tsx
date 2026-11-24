type EmailLinkProps = {
  readonly address: string
}

/**
 * A mailto link that Cloudflare Email Obfuscation leaves alone.
 *
 * Cloudflare rewrites every address it finds in a page into a link to
 * /cdn-cgi/l/email-protection plus a script that decodes it. A crawler does not
 * run that script, so it follows the link and reports a 404 page linked from
 * every page that shows an address. The `email_off` and `email_on` comments are
 * the markers Cloudflare documents for a part of the page it must not rewrite.
 * React cannot render a comment, so the link is written as HTML.
 */
export function EmailLink({ address }: EmailLinkProps) {
  const html = `<!--email_off--><a href="mailto:${address}">${address}</a><!--email_on-->`

  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
