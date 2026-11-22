/* eo/text: see inc/blocks.php. Saved markup is exactly
   <TAG class="…" id="…" aria-hidden="true">rich text</TAG>, with class, id and
   aria-hidden present only when set. Plain JS, no build step. */
(function (wp) {
  var el = wp.element.createElement;
  var RichText = wp.blockEditor.RichText;
  var useBlockProps = wp.blockEditor.useBlockProps;
  var InspectorControls = wp.blockEditor.InspectorControls;
  var PanelBody = wp.components.PanelBody;
  var SelectControl = wp.components.SelectControl;
  var ToggleControl = wp.components.ToggleControl;
  var TAGS = ['div', 'span', 'blockquote', 'small', 'cite', 'address', 'figcaption', 'dt', 'dd'];

  function rootProps(attrs, extra) {
    var props = extra || {};
    if (attrs.ariaHidden) props['aria-hidden'] = 'true';
    return props;
  }

  wp.blocks.registerBlockType('eo/text', {
    edit: function (props) {
      var a = props.attributes;
      var blockProps = useBlockProps(rootProps(a));
      return el(wp.element.Fragment, null,
        el(InspectorControls, null,
          el(PanelBody, { title: 'Element', initialOpen: true },
            el(SelectControl, {
              label: 'HTML tag', value: a.tagName,
              options: TAGS.map(function (t) { return { label: t, value: t }; }),
              onChange: function (v) { props.setAttributes({ tagName: v }); }
            }),
            el(ToggleControl, {
              label: 'Hidden from screen readers (aria-hidden)', checked: !!a.ariaHidden,
              onChange: function (v) { props.setAttributes({ ariaHidden: !!v }); }
            })
          )
        ),
        el(RichText, Object.assign({}, blockProps, {
          tagName: a.tagName || 'div',
          value: a.content,
          onChange: function (v) { props.setAttributes({ content: v }); },
          placeholder: 'Text…',
          allowedFormats: ['core/bold', 'core/italic', 'core/link']
        }))
      );
    },
    save: function (props) {
      var a = props.attributes;
      var blockProps = useBlockProps.save(rootProps(a));
      return el(RichText.Content, Object.assign({}, blockProps, { tagName: a.tagName || 'div', value: a.content }));
    }
  });
})(window.wp);
