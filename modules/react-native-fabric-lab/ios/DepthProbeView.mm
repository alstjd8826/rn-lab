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
  NSInteger _lastSubtree;
  CGSize _lastSize;
}

// self 를 포함해 아래로 뻗은 UIView 를 전부 센다. 내부 라벨은 빼고 센다.
- (NSInteger)countRealViewsIn:(UIView *)view
{
  if (view == _label) {
    return 0;
  }
  NSInteger n = 1;
  for (UIView *child in view.subviews) {
    n += [self countRealViewsIn:child];
  }
  return n;
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
    _lastSubtree = -1;
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
  [self emitProbe];
}

// layoutSubviews 는 "자기 bounds 가 바뀔 때" 불린다. 조상이 나중에 붙으면
// 깊이는 변하는데 layoutSubviews 가 안 불릴 수 있어서, 윈도우에 편입되는
// 시점에도 다시 잰다.
- (void)didMoveToWindow
{
  [super didMoveToWindow];
  [self emitProbe];
}

// Fabric 은 컴포넌트 뷰를 재사용한다. 재사용 시 상태를 안 지우면
// 이전 마운트의 깊이가 남아 이벤트가 억제된다.
- (void)prepareForRecycle
{
  _lastDepth = -1;
  _lastSubtree = -1;
  _lastSize = CGSizeZero;
  [super prepareForRecycle];
}

- (void)emitProbe
{
  if (self.window == nil || !_eventEmitter) {
    return;
  }

  // 위로 올라가며 실제 네이티브 뷰를 센다.
  // 레이아웃 전용 View 는 Fabric 이 플래트닝해서 여기 안 잡힌다.
  NSInteger depth = 0;
  NSMutableArray<NSString *> *chain = [NSMutableArray array];
  UIView *cursor = self.superview;
  while (cursor != nil) {
    depth += 1;
    if (chain.count < 14) {
      // 배경색이 있으면 (bg) 로 표시 — 플래트닝 대상이 아닌 뷰를 구분하기 위해
      CGFloat alpha = 0;
      [cursor.backgroundColor getRed:NULL green:NULL blue:NULL alpha:&alpha];
      NSString *tag = [NSString stringWithFormat:@"%@%@[%.0fx%.0f]",
                                                 NSStringFromClass([cursor class]),
                                                 alpha > 0 ? @"(bg)" : @"",
                                                 cursor.bounds.size.width,
                                                 cursor.bounds.size.height];
      [chain addObject:tag];
    }
    cursor = cursor.superview;
  }

  // 자기 안에 실제로 만들어진 뷰를 재귀로 센다. 내부 라벨은 제외.
  NSInteger subtreeCount = [self countRealViewsIn:self] - 1;

  // 값이 안 바뀌었으면 다시 쏘지 않는다 (레이아웃 루프 방지).
  if (depth == _lastDepth && subtreeCount == _lastSubtree &&
      CGSizeEqualToSize(self.bounds.size, _lastSize)) {
    return;
  }
  _lastDepth = depth;
  _lastSubtree = subtreeCount;
  _lastSize = self.bounds.size;

  DepthProbeViewEventEmitter::OnProbe payload{
      .subtreeCount = static_cast<int>(subtreeCount),
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
