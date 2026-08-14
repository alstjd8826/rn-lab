#import "DepthProbeView.h"

#import <react/renderer/components/FabricLabSpecs/ComponentDescriptors.h>
#import <react/renderer/components/FabricLabSpecs/EventEmitters.h>
#import <react/renderer/components/FabricLabSpecs/Props.h>
#import <react/renderer/components/FabricLabSpecs/RCTComponentViewHelpers.h>

using namespace facebook::react;

@interface DepthProbeView () <RCTDepthProbeViewViewProtocol>
@end

@implementation DepthProbeView {
  UILabel *_label;
  NSInteger _lastDepth;
  CGSize _lastSize;
}

// Fabric 이 이 클래스를 컴포넌트로 인식하는 진입점.
+ (ComponentDescriptorProvider)componentDescriptorProvider
{
  return concreteComponentDescriptorProvider<DepthProbeViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
  if (self = [super initWithFrame:frame]) {
    _lastDepth = -1;
    _lastSize = CGSizeZero;

    _label = [[UILabel alloc] initWithFrame:CGRectZero];
    _label.textAlignment = NSTextAlignmentCenter;
    _label.numberOfLines = 2;
    _label.font = [UIFont monospacedSystemFontOfSize:11 weight:UIFontWeightSemibold];
    _label.textColor = [UIColor whiteColor];
    self.backgroundColor = [UIColor colorWithRed:0.63 green:0.35 blue:0.10 alpha:1.0];
    [self addSubview:_label];
  }
  return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
  const auto &newViewProps = *std::static_pointer_cast<DepthProbeViewProps const>(props);

  NSString *text = [NSString stringWithUTF8String:newViewProps.label.c_str()];
  if (text.length > 0) {
    _label.text = text;
  }

  [super updateProps:props oldProps:oldProps];
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  _label.frame = self.bounds;

  // 위로 올라가며 실제 네이티브 뷰를 센다.
  // 레이아웃 전용 View 는 Fabric 이 플래트닝해서 여기 안 잡힌다.
  NSInteger depth = 0;
  NSMutableArray<NSString *> *chain = [NSMutableArray array];
  UIView *cursor = self.superview;
  while (cursor != nil) {
    depth += 1;
    if (chain.count < 6) {
      [chain addObject:NSStringFromClass([cursor class])];
    }
    cursor = cursor.superview;
  }

  // 값이 안 바뀌었으면 이벤트를 다시 쏘지 않는다 (레이아웃 루프 방지).
  if (depth == _lastDepth && CGSizeEqualToSize(self.bounds.size, _lastSize)) {
    return;
  }
  _lastDepth = depth;
  _lastSize = self.bounds.size;

  if (!_eventEmitter) {
    return;
  }

  DepthProbeViewEventEmitter::OnProbe payload{
      .depth = static_cast<int>(depth),
      .width = static_cast<double>(self.bounds.size.width),
      .height = static_cast<double>(self.bounds.size.height),
      .chain = std::string([[chain componentsJoinedByString:@" ← "] UTF8String]),
  };
  [self probeEmitter].onProbe(payload);
}

- (const DepthProbeViewEventEmitter &)probeEmitter
{
  return static_cast<const DepthProbeViewEventEmitter &>(*_eventEmitter);
}

@end

// 서드파티 Fabric 컴포넌트 등록용. Codegen 이 이 이름을 찾는다.
Class<RCTComponentViewProtocol> DepthProbeViewCls(void)
{
  return DepthProbeView.class;
}
