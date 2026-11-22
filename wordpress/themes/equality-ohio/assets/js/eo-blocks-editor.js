/* Editor-side registration of the theme's dynamic chrome blocks. They render
   through ServerSideRender, so the Site Editor shows the real header, footer,
   help bar and 404 body; nothing here runs on the front end. */
(function (wp) {
  if (!wp || !wp.blocks) return;
  var el = wp.element.createElement;
  var SSR = wp.serverSideRender;
  var useBlockProps = wp.blockEditor.useBlockProps;
  var defs = [
    ['eo/site-header', 'EO Site Header'],
    ['eo/site-footer', 'EO Site Footer'],
    ['eo/help-bar', 'EO Legal Clinic Help Bar'],
    ['eo/not-found', 'EO 404 Body']
  ];
  defs.forEach(function (d) {
    wp.blocks.registerBlockType(d[0], {
      title: d[1],
      icon: 'layout',
      category: 'theme',
      edit: function () {
        return el('div', useBlockProps({ className: 'eo-ssr' }), el(SSR, { block: d[0] }));
      },
      save: function () { return null; }
    });
  });
})(window.wp);
